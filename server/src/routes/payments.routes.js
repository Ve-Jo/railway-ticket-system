import { Router } from "express";
import { withTransaction } from "../db/connection.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { writeOperationLog } from "../services/operationLogs.js";
import {
  formatDateTimeForMySql,
  generateReference,
  parseStoredDateTime
} from "../utils/bookingHelpers.js";

const router = Router();

router.use(requireAuth);

router.post("/", async (req, res, next) => {
  try {
    const { bookingId, method, amount } = req.body ?? {};
    const numericBookingId = Number(bookingId);
    const numericAmount = Number(amount);
    const paymentMethod = method === "cash" || method === "card" ? method : "demo";

    if (!Number.isInteger(numericBookingId) || numericBookingId <= 0) {
      return res.status(422).json({
        message: "bookingId must be a positive integer"
      });
    }

    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      return res.status(422).json({
        message: "amount must be a non-negative number"
      });
    }

    const actor = req.session.user;
    const result = await withTransaction(async (connection) => {
      const [bookingRows] = await connection.execute(
        `
          SELECT
            bookings.id,
            bookings.booking_number,
            bookings.trip_id,
            bookings.carriage_id,
            bookings.seat_id,
            bookings.user_id,
            bookings.status,
            bookings.total_price,
            bookings.reserved_until,
            bookings.paid_at,
            trips.departure_datetime
          FROM bookings
          INNER JOIN trips ON trips.id = bookings.trip_id
          WHERE bookings.id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [numericBookingId]
      );

      const booking = bookingRows[0];
      if (!booking) {
        return { type: "not_found" };
      }

      const isPrivileged = actor.role === "cashier" || actor.role === "admin";
      if (!isPrivileged && booking.user_id !== actor.id) {
        return { type: "forbidden" };
      }

      if (booking.status !== "reserved") {
        return { type: "conflict", message: "Booking is not active for payment" };
      }

      const reservedUntil = parseStoredDateTime(booking.reserved_until);
      const now = new Date();
      if (!reservedUntil || reservedUntil <= now) {
        await connection.execute(
          `
            UPDATE bookings
            SET status = 'expired',
                cancelled_at = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [formatDateTimeForMySql(now), booking.id]
        );

        return { type: "conflict", message: "Booking has expired" };
      }

      if (Number(booking.total_price) !== numericAmount) {
        return { type: "conflict", message: "Payment amount does not match booking price" };
      }

      const paymentReference = generateReference("PAY");
      const ticketNumber = generateReference("TK");
      const paidAt = formatDateTimeForMySql(now);

      const [paymentInsert] = await connection.execute(
        `
          INSERT INTO payments (
            booking_id,
            processed_by_user_id,
            payment_reference,
            payment_method,
            status,
            amount,
            paid_at
          )
          VALUES (?, ?, ?, ?, 'succeeded', ?, ?)
        `,
        [booking.id, actor.id, paymentReference, paymentMethod, numericAmount, paidAt]
      );

      await connection.execute(
        `
          UPDATE bookings
          SET status = 'paid',
              paid_at = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [paidAt, booking.id]
      );

      const [ticketInsert] = await connection.execute(
        `
          INSERT INTO tickets (
            booking_id,
            ticket_number,
            ticket_status,
            issued_at,
            qr_payload
          )
          VALUES (?, ?, 'issued', ?, ?)
        `,
        [booking.id, ticketNumber, paidAt, ticketNumber]
      );

      return {
        type: "success",
        payment: {
          id: paymentInsert.insertId,
          status: "completed",
          bookingId: booking.id,
          amount: numericAmount,
          method: paymentMethod,
          paidAt: now.toISOString()
        },
        ticket: {
          id: ticketInsert.insertId,
          ticketNumber,
          status: "issued"
        }
      };
    });

    if (result.type === "not_found") {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (result.type === "forbidden") {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (result.type === "conflict") {
      return res.status(409).json({ message: result.message });
    }

    await writeOperationLog({
      actorUserId: actor.id,
      entityType: "booking",
      entityId: result.payment.bookingId,
      action: "payment.create",
      resultStatus: "success",
      ipAddress: req.ip,
      details: {
        paymentId: result.payment.id,
        ticketId: result.ticket.id,
        amount: result.payment.amount
      }
    });

    return res.status(201).json({
      payment: result.payment,
      ticket: result.ticket
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
