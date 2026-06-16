import { Router } from "express";
import { query, withTransaction } from "../db/connection.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { toIsoOrNull } from "../utils/bookingHelpers.js";

const router = Router();

router.use(requireAuth);

router.get("/my", requireRole("passenger"), async (req, res, next) => {
  try {
    const scope = String(req.query.scope ?? "active").trim();
    const userId = req.session.user.id;

    let statusFilterSql = "";
    if (scope === "active") {
      statusFilterSql = "AND tickets.ticket_status = 'issued' AND bookings.status = 'paid'";
    } else if (scope === "history") {
      statusFilterSql = "AND (tickets.ticket_status <> 'issued' OR bookings.status <> 'paid')";
    }

    const items = await query(
      `
        SELECT
          tickets.id,
          tickets.ticket_number,
          tickets.ticket_status AS status,
          bookings.trip_id,
          trips.departure_datetime AS departureAt,
          trips.arrival_datetime AS arrivalAt,
          seats.seat_number AS seatNumber,
          carriages.carriage_number AS carriageNumber,
          origin_station.name AS departureStation,
          destination_station.name AS arrivalStation
        FROM tickets
        INNER JOIN bookings ON bookings.id = tickets.booking_id
        INNER JOIN trips ON trips.id = bookings.trip_id
        INNER JOIN routes ON routes.id = trips.route_id
        INNER JOIN stations AS origin_station ON origin_station.id = routes.origin_station_id
        INNER JOIN stations AS destination_station ON destination_station.id = routes.destination_station_id
        INNER JOIN seats ON seats.id = bookings.seat_id
        INNER JOIN carriages ON carriages.id = bookings.carriage_id
        WHERE bookings.user_id = ?
        ${statusFilterSql}
        ORDER BY trips.departure_datetime DESC, tickets.id DESC
      `,
      [userId]
    );

    return res.json({ items });
  } catch (error) {
    return next(error);
  }
});

router.get("/:ticketId", async (req, res, next) => {
  try {
    const ticketId = Number(req.params.ticketId);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return res.status(422).json({ message: "ticketId must be a positive integer" });
    }

    const actor = req.session.user;
    const result = await withTransaction(async (connection) => {
      const [rows] = await connection.execute(
        `
          SELECT
            tickets.id,
            tickets.ticket_number,
            tickets.ticket_status,
            tickets.issued_at,
            tickets.refunded_at,
            bookings.id AS booking_id,
            bookings.user_id,
            bookings.trip_id,
            bookings.total_price,
            trips.departure_datetime,
            trips.arrival_datetime,
            seats.seat_number,
            carriages.carriage_number,
            routes.origin_station_id,
            routes.destination_station_id,
            origin_station.name AS departure_station,
            destination_station.name AS arrival_station
          FROM tickets
          INNER JOIN bookings ON bookings.id = tickets.booking_id
          INNER JOIN trips ON trips.id = bookings.trip_id
          INNER JOIN routes ON routes.id = trips.route_id
          INNER JOIN stations AS origin_station ON origin_station.id = routes.origin_station_id
          INNER JOIN stations AS destination_station ON destination_station.id = routes.destination_station_id
          INNER JOIN seats ON seats.id = bookings.seat_id
          INNER JOIN carriages ON carriages.id = bookings.carriage_id
          WHERE tickets.id = ?
          LIMIT 1
        `,
        [ticketId]
      );

      const ticket = rows[0];
      if (!ticket) {
        return { type: "not_found" };
      }

      const isPrivileged = actor.role === "cashier" || actor.role === "admin";
      if (!isPrivileged && ticket.user_id !== actor.id) {
        return { type: "forbidden" };
      }

      return {
        type: "success",
        ticket: {
          id: ticket.id,
          ticketNumber: ticket.ticket_number,
          status: ticket.ticket_status,
          bookingId: ticket.booking_id,
          tripId: ticket.trip_id,
          departureAt: toIsoOrNull(ticket.departure_datetime),
          arrivalAt: toIsoOrNull(ticket.arrival_datetime),
          issuedAt: toIsoOrNull(ticket.issued_at),
          refundedAt: toIsoOrNull(ticket.refunded_at),
          departureStation: ticket.departure_station,
          arrivalStation: ticket.arrival_station,
          seatNumber: ticket.seat_number,
          carriageNumber: ticket.carriage_number,
          price: Number(ticket.total_price)
        }
      };
    });

    if (result.type === "not_found") {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (result.type === "forbidden") {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json({ ticket: result.ticket });
  } catch (error) {
    return next(error);
  }
});

export default router;
