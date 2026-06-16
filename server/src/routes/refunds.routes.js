import { Router } from "express";
import { withTransaction } from "../db/connection.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { writeOperationLog } from "../services/operationLogs.js";
import {
  formatDateTimeForMySql,
  generateReference
} from "../utils/bookingHelpers.js";

const router = Router();

router.use(requireAuth);

router.post("/", async (req, res, next) => {
  try {
    const { ticketId, reason } = req.body ?? {};
    const numericTicketId = Number(ticketId);

    if (!Number.isInteger(numericTicketId) || numericTicketId <= 0) {
      return res.status(422).json({
        message: "ticketId must be a positive integer"
      });
    }

    const actor = req.session.user;
    const result = await withTransaction(async (connection) => {
      const [rows] = await connection.execute(
        `
          SELECT
            tickets.id AS ticket_id,
            tickets.ticket_number,
            tickets.ticket_status,
            bookings.id AS booking_id,
            bookings.user_id,
            bookings.status AS booking_status,
            bookings.total_price,
            trips.departure_datetime,
            payments.id AS payment_id
          FROM tickets
          INNER JOIN bookings ON bookings.id = tickets.booking_id
          INNER JOIN trips ON trips.id = bookings.trip_id
          LEFT JOIN payments
            ON payments.booking_id = bookings.id
           AND payments.status = 'succeeded'
          WHERE tickets.id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [numericTicketId]
      );

      const ticket = rows[0];
      if (!ticket) {
        return { type: "not_found" };
      }

      const isPrivileged = actor.role === "cashier" || actor.role === "admin";
      if (!isPrivileged && ticket.user_id !== actor.id) {
        return { type: "forbidden" };
      }

      if (ticket.ticket_status !== "issued" || ticket.booking_status !== "paid") {
        return { type: "conflict", message: "Ticket is not eligible for refund" };
      }

      const now = new Date();
      if (new Date(ticket.departure_datetime) <= now) {
        return { type: "conflict", message: "Trip has already started" };
      }

      const refundReference = generateReference("RF");
      const refundedAt = formatDateTimeForMySql(now);

      const [refundInsert] = await connection.execute(
        `
          INSERT INTO refunds (
            ticket_id,
            booking_id,
            payment_id,
            processed_by_user_id,
            refund_reference,
            amount,
            reason,
            status,
            refunded_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?)
        `,
        [
          ticket.ticket_id,
          ticket.booking_id,
          ticket.payment_id ?? null,
          actor.id,
          refundReference,
          ticket.total_price,
          reason ?? null,
          refundedAt
        ]
      );

      await connection.execute(
        `
          UPDATE tickets
          SET ticket_status = 'refunded',
              refunded_at = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [refundedAt, ticket.ticket_id]
      );

      await connection.execute(
        `
          UPDATE bookings
          SET status = 'refunded',
              refunded_at = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [refundedAt, ticket.booking_id]
      );

      if (ticket.payment_id) {
        await connection.execute(
          `
            UPDATE payments
            SET status = 'refunded',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [ticket.payment_id]
        );
      }

      return {
        type: "success",
        refund: {
          id: refundInsert.insertId,
          ticketId: ticket.ticket_id,
          status: "completed",
          refundedAt: now.toISOString()
        }
      };
    });

    if (result.type === "not_found") {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (result.type === "forbidden") {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (result.type === "conflict") {
      return res.status(409).json({ message: result.message });
    }

    await writeOperationLog({
      actorUserId: actor.id,
      entityType: "refund",
      entityId: result.refund.id,
      action: "refund.create",
      resultStatus: "success",
      ipAddress: req.ip,
      details: { ticketId: result.refund.ticketId }
    });

    return res.status(201).json({ refund: result.refund });
  } catch (error) {
    return next(error);
  }
});

export default router;
