import { Router } from "express";
import { withTransaction } from "../db/connection.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { writeOperationLog } from "../services/operationLogs.js";
import {
  addMinutes,
  formatDateTimeForMySql,
  generateReference,
  parseStoredDateTime,
  toIsoOrNull
} from "../utils/bookingHelpers.js";

const router = Router();

router.use(requireAuth);

router.post("/", async (req, res, next) => {
  try {
    const { tripId, carriageId, seatId, passengerUserId } = req.body ?? {};
    const numericTripId = Number(tripId);
    const numericCarriageId = Number(carriageId);
    const numericSeatId = Number(seatId);
    const actor = req.session.user;
    const isPrivileged = actor.role === "cashier" || actor.role === "admin";
    const targetUserId = isPrivileged && passengerUserId ? Number(passengerUserId) : actor.id;

    if (!Number.isInteger(numericTripId) || numericTripId <= 0) {
      return res.status(422).json({ message: "tripId must be a positive integer" });
    }

    if (!Number.isInteger(numericCarriageId) || numericCarriageId <= 0) {
      return res.status(422).json({ message: "carriageId must be a positive integer" });
    }

    if (!Number.isInteger(numericSeatId) || numericSeatId <= 0) {
      return res.status(422).json({ message: "seatId must be a positive integer" });
    }

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(422).json({ message: "passengerUserId must be a positive integer" });
    }

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

      const now = new Date();
      if (new Date(trip.departure_datetime) <= now) {
        return { type: "conflict", message: "Trip has already departed" };
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
        [targetUserId]
      );

      const passenger = userRows[0];
      if (!passenger) {
        return { type: "not_found", entity: "passenger" };
      }

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
            AND (
              status = 'paid'
              OR (
                status = 'reserved'
                AND (
                  reserved_until IS NULL
                  OR reserved_until > ?
                )
              )
            )
          LIMIT 1
          FOR UPDATE
        `,
        [
          numericTripId,
          numericCarriageId,
          numericSeatId,
          formatDateTimeForMySql(now)
        ]
      );

      if (activeBookingRows.length > 0) {
        return { type: "conflict", message: "Seat is already reserved or paid" };
      }

      const reservedUntil = addMinutes(now, 15);
      const bookingNumber = generateReference("BK");

      const [insertResult] = await connection.execute(
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
            reserved_until,
            total_price
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'reserved', ?, ?)
        `,
        [
          bookingNumber,
          numericTripId,
          numericCarriageId,
          numericSeatId,
          targetUserId,
          actor.id,
          passenger.full_name,
          isPrivileged ? "cashier" : "passenger",
          formatDateTimeForMySql(reservedUntil),
          trip.base_price
        ]
      );

      return {
        type: "success",
        booking: {
          id: insertResult.insertId,
          bookingNumber,
          status: "reserved",
          reservedUntil: reservedUntil.toISOString(),
          tripId: numericTripId,
          carriageId: numericCarriageId,
          seatId: numericSeatId,
          userId: targetUserId,
          price: Number(trip.base_price)
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
      action: "booking.create",
      resultStatus: "success",
      ipAddress: req.ip,
      details: {
        tripId: result.booking.tripId,
        carriageId: result.booking.carriageId,
        seatId: result.booking.seatId,
        userId: result.booking.userId
      }
    });

    return res.status(201).json({ booking: result.booking });
  } catch (error) {
    return next(error);
  }
});

router.get("/:bookingId", async (req, res, next) => {
  try {
    const bookingId = Number(req.params.bookingId);
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(422).json({ message: "bookingId must be a positive integer" });
    }

    const result = await withTransaction(async (connection) => {
      const [rows] = await connection.execute(
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
            bookings.cancelled_at,
            bookings.refunded_at,
            trips.departure_datetime,
            carriages.carriage_number,
            seats.seat_number
          FROM bookings
          INNER JOIN trips ON trips.id = bookings.trip_id
          INNER JOIN carriages ON carriages.id = bookings.carriage_id
          INNER JOIN seats ON seats.id = bookings.seat_id
          WHERE bookings.id = ?
          LIMIT 1
        `,
        [bookingId]
      );

      const booking = rows[0];
      if (!booking) {
        return { type: "not_found" };
      }

      const actor = req.session.user;
      const isPrivileged = actor.role === "cashier" || actor.role === "admin";
      if (!isPrivileged && booking.user_id !== actor.id) {
        return { type: "forbidden" };
      }

      return {
        type: "success",
        booking: {
          id: booking.id,
          bookingNumber: booking.booking_number,
          tripId: booking.trip_id,
          carriageId: booking.carriage_id,
          seatId: booking.seat_id,
          carriageNumber: booking.carriage_number,
          seatNumber: booking.seat_number,
          userId: booking.user_id,
          status: booking.status,
          price: Number(booking.total_price),
          reservedUntil: toIsoOrNull(booking.reserved_until),
          paidAt: toIsoOrNull(booking.paid_at),
          cancelledAt: toIsoOrNull(booking.cancelled_at),
          refundedAt: toIsoOrNull(booking.refunded_at),
          departureAt: toIsoOrNull(booking.departure_datetime)
        }
      };
    });

    if (result.type === "not_found") {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (result.type === "forbidden") {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json({ booking: result.booking });
  } catch (error) {
    return next(error);
  }
});

router.post("/:bookingId/cancel", async (req, res, next) => {
  try {
    const bookingId = Number(req.params.bookingId);
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(422).json({ message: "bookingId must be a positive integer" });
    }

    const actor = req.session.user;
    const result = await withTransaction(async (connection) => {
      const [rows] = await connection.execute(
        `
          SELECT id, user_id, status, reserved_until
          FROM bookings
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [bookingId]
      );

      const booking = rows[0];
      if (!booking) {
        return { type: "not_found" };
      }

      const isPrivileged = actor.role === "cashier" || actor.role === "admin";
      if (!isPrivileged && booking.user_id !== actor.id) {
        return { type: "forbidden" };
      }

      if (booking.status !== "reserved") {
        return { type: "conflict", message: "Booking cannot be cancelled in its current state" };
      }

      const now = new Date();
      const reservedUntil = parseStoredDateTime(booking.reserved_until);
      const nextStatus = reservedUntil && reservedUntil <= now ? "expired" : "cancelled";

      await connection.execute(
        `
          UPDATE bookings
          SET status = ?,
              cancelled_at = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [nextStatus, formatDateTimeForMySql(now), bookingId]
      );

      return {
        type: "success",
        booking: {
          id: bookingId,
          status: nextStatus,
          cancelledAt: now.toISOString()
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
      entityId: bookingId,
      action: "booking.cancel",
      resultStatus: "success",
      ipAddress: req.ip,
      details: { status: result.booking.status }
    });

    return res.json({ booking: result.booking });
  } catch (error) {
    return next(error);
  }
});

export default router;
