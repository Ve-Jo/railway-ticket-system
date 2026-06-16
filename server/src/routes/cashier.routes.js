import { Router } from "express";
import { query, withTransaction } from "../db/connection.js";
import { requireRole } from "../middleware/requireRole.js";
import { writeOperationLog } from "../services/operationLogs.js";
import {
  formatDateTimeForMySql,
  generateReference,
  toIsoOrNull
} from "../utils/bookingHelpers.js";

const router = Router();

router.use(requireRole("cashier", "admin"));

router.get("/search", async (req, res, next) => {
  try {
    const term = String(req.query.term ?? "").trim();
    if (!term) {
      return res.status(422).json({ message: "term is required" });
    }

    const pattern = `%${term}%`;

    const bookings = await query(
      `
        SELECT
          bookings.id,
          bookings.status,
          bookings.booking_number,
          bookings.user_id,
          users.username,
          users.full_name,
          bookings.trip_id,
          trips.trip_code,
          bookings.total_price,
          bookings.reserved_until
        FROM bookings
        INNER JOIN users ON users.id = bookings.user_id
        INNER JOIN trips ON trips.id = bookings.trip_id
        WHERE
          bookings.booking_number LIKE ?
          OR users.username LIKE ?
          OR users.full_name LIKE ?
          OR CAST(bookings.id AS CHAR) = ?
        ORDER BY bookings.id DESC
        LIMIT 20
      `,
      [pattern, pattern, pattern, term]
    );

    const tickets = await query(
      `
        SELECT
          tickets.id,
          tickets.ticket_number,
          tickets.ticket_status AS status,
          bookings.id AS booking_id,
          bookings.user_id,
          users.username,
          users.full_name,
          trips.trip_code,
          bookings.total_price
        FROM tickets
        INNER JOIN bookings ON bookings.id = tickets.booking_id
        INNER JOIN users ON users.id = bookings.user_id
        INNER JOIN trips ON trips.id = bookings.trip_id
        WHERE
          tickets.ticket_number LIKE ?
          OR users.username LIKE ?
          OR users.full_name LIKE ?
          OR CAST(tickets.id AS CHAR) = ?
        ORDER BY tickets.id DESC
        LIMIT 20
      `,
      [pattern, pattern, pattern, term]
    );

    return res.json({ bookings, tickets });
  } catch (error) {
    return next(error);
  }
});

router.post("/sales", async (req, res, next) => {
  try {
    const { tripId, carriageId, seatId, passengerUserId, method, amount } = req.body ?? {};
    const numericTripId = Number(tripId);
    const numericCarriageId = Number(carriageId);
    const numericSeatId = Number(seatId);
    const numericPassengerUserId = Number(passengerUserId);
    const numericAmount = amount != null ? Number(amount) : null;
    const paymentMethod = method === "cash" || method === "card" ? method : "cash";

    if (!Number.isInteger(numericTripId) || numericTripId <= 0) {
      return res.status(422).json({ message: "tripId must be a positive integer" });
    }

    if (!Number.isInteger(numericCarriageId) || numericCarriageId <= 0) {
      return res.status(422).json({ message: "carriageId must be a positive integer" });
    }

    if (!Number.isInteger(numericSeatId) || numericSeatId <= 0) {
      return res.status(422).json({ message: "seatId must be a positive integer" });
    }

    if (!Number.isInteger(numericPassengerUserId) || numericPassengerUserId <= 0) {
      return res.status(422).json({ message: "passengerUserId must be a positive integer" });
    }

    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      return res.status(422).json({ message: "amount must be a non-negative number" });
    }

    const actor = req.session.user;

    const result = await withTransaction(async (connection) => {
      const [tripRows] = await connection.execute(
        `
          SELECT id, base_price, status, departure_datetime
          FROM trips
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [numericTripId]
      );

      const trip = tripRows[0];
      if (!trip) {
        return { type: "not_found", entity: "trip" };
      }

      if (trip.status !== "scheduled") {
        return { type: "conflict", message: "Trip is not available for booking" };
      }

      const [seatRows] = await connection.execute(
        `
          SELECT
            seats.id AS seat_id,
            seats.seat_number,
            carriages.id AS carriage_id,
            carriages.carriage_number
          FROM seats
          INNER JOIN carriages ON carriages.id = seats.carriage_id
          INNER JOIN trains ON trains.id = carriages.train_id
          INNER JOIN trips ON trips.train_id = trains.id
          WHERE trips.id = ?
            AND carriages.id = ?
            AND seats.id = ?
            AND seats.is_active = 1
            AND carriages.is_active = 1
          LIMIT 1
          FOR UPDATE
        `,
        [numericTripId, numericCarriageId, numericSeatId]
      );

      const seat = seatRows[0];
      if (!seat) {
        return { type: "not_found", entity: "seat" };
      }

      const [userRows] = await connection.execute(
        `
          SELECT id, full_name
          FROM users
          WHERE id = ? AND is_active = 1
          LIMIT 1
        `,
        [numericPassengerUserId]
      );

      const passenger = userRows[0];
      if (!passenger) {
        return { type: "not_found", entity: "passenger" };
      }

      const now = new Date();

      await connection.execute(
        `
          UPDATE bookings
          SET status = 'expired',
              cancelled_at = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE trip_id = ?
            AND carriage_id = ?
            AND seat_id = ?
            AND status = 'reserved'
            AND reserved_until IS NOT NULL
            AND reserved_until <= ?
        `,
        [
          formatDateTimeForMySql(now),
          numericTripId,
          numericCarriageId,
          numericSeatId,
          formatDateTimeForMySql(now)
        ]
      );

      const [activeBookingRows] = await connection.execute(
        `
          SELECT id
          FROM bookings
          WHERE trip_id = ?
            AND carriage_id = ?
            AND seat_id = ?
            AND status IN ('reserved', 'paid')
          LIMIT 1
          FOR UPDATE
        `,
        [numericTripId, numericCarriageId, numericSeatId]
      );

      if (activeBookingRows.length > 0) {
        return { type: "conflict", message: "Seat is already reserved or paid" };
      }

      if (Number(trip.base_price) !== numericAmount) {
        return { type: "conflict", message: "Payment amount does not match trip price" };
      }

      const bookingNumber = generateReference("BK");
      const paymentReference = generateReference("PAY");
      const ticketNumber = generateReference("TK");
      const paidAt = formatDateTimeForMySql(now);

      const [bookingInsert] = await connection.execute(
        `
          INSERT INTO bookings (
            booking_number,
            trip_id,
            carriage_id,
            seat_id,
            user_id,
            created_by_user_id,
            passenger_full_name,
            source_channel,
            status,
            paid_at,
            total_price
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, 'cashier', 'paid', ?, ?)
        `,
        [
          bookingNumber,
          numericTripId,
          numericCarriageId,
          numericSeatId,
          numericPassengerUserId,
          actor.id,
          passenger.full_name,
          paidAt,
          trip.base_price
        ]
      );

      const bookingId = bookingInsert.insertId;

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
        [bookingId, actor.id, paymentReference, paymentMethod, numericAmount, paidAt]
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
        [bookingId, ticketNumber, paidAt, ticketNumber]
      );

      return {
        type: "success",
        booking: {
          id: bookingId,
          bookingNumber,
          status: "paid",
          tripId: numericTripId,
          carriageId: numericCarriageId,
          seatId: numericSeatId,
          userId: numericPassengerUserId,
          price: Number(trip.base_price),
          paidAt: now.toISOString()
        },
        payment: {
          id: paymentInsert.insertId,
          status: "completed",
          bookingId,
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
      return res.status(404).json({ message: `${result.entity} not found` });
    }

    if (result.type === "conflict") {
      return res.status(409).json({ message: result.message });
    }

    await writeOperationLog({
      actorUserId: actor.id,
      entityType: "booking",
      entityId: result.booking.id,
      action: "cashier.sale",
      resultStatus: "success",
      ipAddress: req.ip,
      details: {
        tripId: result.booking.tripId,
        carriageId: result.booking.carriageId,
        seatId: result.booking.seatId,
        userId: result.booking.userId,
        paymentId: result.payment.id,
        ticketId: result.ticket.id,
        amount: result.payment.amount
      }
    });

    return res.status(201).json({
      booking: result.booking,
      payment: result.payment,
      ticket: result.ticket
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
