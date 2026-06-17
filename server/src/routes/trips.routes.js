import { Router } from "express";
import { query } from "../db/connection.js";
import {
  getSearchableTripStatuses,
  getTripAvailability
} from "../services/tripMaintenance.js";

const router = Router();
const searchableTripStatuses = getSearchableTripStatuses();

router.get("/search", async (req, res, next) => {
  try {
    const fromStationId = Number(req.query.fromStationId);
    const toStationId = Number(req.query.toStationId);
    const date = String(req.query.date ?? "").trim();

    if (!Number.isInteger(fromStationId) || fromStationId <= 0) {
      return res.status(422).json({
        message: "fromStationId must be a positive integer"
      });
    }

    if (!Number.isInteger(toStationId) || toStationId <= 0) {
      return res.status(422).json({
        message: "toStationId must be a positive integer"
      });
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(422).json({
        message: "date must be provided in YYYY-MM-DD format"
      });
    }

    const items = await query(
      `
        SELECT
          trips.id,
          trips.trip_code AS routeCode,
          trips.status AS status,
          trains.name AS trainName,
          origin_station.name AS departureStation,
          destination_station.name AS arrivalStation,
          trips.departure_datetime AS departureAt,
          trips.arrival_datetime AS arrivalAt,
          trips.base_price AS basePrice,
          GROUP_CONCAT(DISTINCT carriages.carriage_type ORDER BY carriages.carriage_type SEPARATOR '|') AS carriageTypes,
          GROUP_CONCAT(DISTINCT carriages.class_code ORDER BY carriages.class_code SEPARATOR '|') AS carriageClassCodes,
          COUNT(seats.id) - COUNT(DISTINCT active_bookings.id) AS availableSeats
        FROM trips
        INNER JOIN routes ON routes.id = trips.route_id
        INNER JOIN trains ON trains.id = trips.train_id
        INNER JOIN route_stations AS origin_route_station
          ON origin_route_station.route_id = routes.id
         AND origin_route_station.station_id = ?
        INNER JOIN route_stations AS destination_route_station
          ON destination_route_station.route_id = routes.id
         AND destination_route_station.station_id = ?
         AND destination_route_station.stop_order > origin_route_station.stop_order
        INNER JOIN stations AS origin_station ON origin_station.id = origin_route_station.station_id
        INNER JOIN stations AS destination_station ON destination_station.id = destination_route_station.station_id
        INNER JOIN carriages ON carriages.train_id = trains.id AND carriages.is_active = 1
        INNER JOIN seats ON seats.carriage_id = carriages.id AND seats.is_active = 1
        LEFT JOIN bookings AS active_bookings
          ON active_bookings.trip_id = trips.id
         AND active_bookings.seat_id = seats.id
         AND (
           active_bookings.status = 'paid'
           OR (
             active_bookings.status = 'reserved'
             AND (
               active_bookings.reserved_until IS NULL
               OR active_bookings.reserved_until > NOW()
             )
           )
         )
        WHERE trips.status IN (?, ?)
          AND trips.departure_date = ?
        GROUP BY
          trips.id,
          trips.trip_code,
          trips.status,
          trains.name,
          origin_station.name,
          destination_station.name,
          trips.departure_datetime,
          trips.arrival_datetime,
          trips.base_price
        ORDER BY trips.departure_datetime ASC
      `,
      [fromStationId, toStationId, ...searchableTripStatuses, date]
    );

    const now = new Date();
    const normalizedItems = items
      .map((item) => ({
        ...item,
        ...getTripAvailability(item, now)
      }))
      .sort(compareTripsForSearch);

    return res.json({ items: normalizedItems });
  } catch (error) {
    return next(error);
  }
});

router.get("/:tripId", async (req, res, next) => {
  try {
    const tripId = Number(req.params.tripId);

    if (!Number.isInteger(tripId) || tripId <= 0) {
      return res.status(422).json({
        message: "tripId must be a positive integer"
      });
    }

    const tripRows = await query(
      `
        SELECT
          trips.id,
          trips.trip_code AS routeCode,
          trips.status AS status,
          trains.name AS trainName,
          trips.departure_datetime AS departureAt,
          trips.arrival_datetime AS arrivalAt,
          trips.base_price AS basePrice,
          routes.origin_station_id,
          routes.destination_station_id,
          origin_station.name AS departureStation,
          destination_station.name AS arrivalStation
        FROM trips
        INNER JOIN routes ON routes.id = trips.route_id
        INNER JOIN trains ON trains.id = trips.train_id
        INNER JOIN stations AS origin_station ON origin_station.id = routes.origin_station_id
        INNER JOIN stations AS destination_station ON destination_station.id = routes.destination_station_id
        WHERE trips.id = ?
        LIMIT 1
      `,
      [tripId]
    );

    const trip = tripRows[0];
    if (!trip) {
      return res.status(404).json({
        message: "Trip not found"
      });
    }

    const seatRows = await query(
      `
        SELECT
          carriages.id AS carriageId,
          carriages.carriage_number AS carriageNumber,
          carriages.carriage_type AS carriageType,
          carriages.class_code AS carriageClassCode,
          seats.id AS seatId,
          seats.seat_number AS seatNumber,
          seats.seat_type AS seatType,
          seats.class_code AS seatClassCode,
          CASE
            WHEN active_bookings.id IS NULL THEN 'available'
            ELSE active_bookings.status
          END AS seatStatus
        FROM trips
        INNER JOIN trains ON trains.id = trips.train_id
        INNER JOIN carriages ON carriages.train_id = trains.id AND carriages.is_active = 1
        INNER JOIN seats ON seats.carriage_id = carriages.id AND seats.is_active = 1
        LEFT JOIN bookings AS active_bookings
          ON active_bookings.trip_id = trips.id
         AND active_bookings.seat_id = seats.id
         AND (
           active_bookings.status = 'paid'
           OR (
             active_bookings.status = 'reserved'
             AND (
               active_bookings.reserved_until IS NULL
               OR active_bookings.reserved_until > NOW()
             )
           )
         )
        WHERE trips.id = ?
        ORDER BY carriages.carriage_number ASC, seats.seat_number ASC
      `,
      [tripId]
    );

    const carriagesMap = new Map();
    for (const row of seatRows) {
      if (!carriagesMap.has(row.carriageId)) {
        carriagesMap.set(row.carriageId, {
          id: row.carriageId,
          number: row.carriageNumber,
          type: row.carriageType,
          classCode: row.carriageClassCode,
          seats: []
        });
      }

      carriagesMap.get(row.carriageId).seats.push({
        id: row.seatId,
        number: row.seatNumber,
        status: row.seatStatus,
        type: row.seatType,
        classCode: row.seatClassCode
      });
    }

    return res.json({
      trip: {
        id: trip.id,
        routeCode: trip.routeCode,
        status: trip.status,
        trainName: trip.trainName,
        departureStation: trip.departureStation,
        arrivalStation: trip.arrivalStation,
        departureAt: trip.departureAt,
        arrivalAt: trip.arrivalAt,
        basePrice: trip.basePrice,
        ...getTripAvailability(trip)
      },
      carriages: Array.from(carriagesMap.values())
    });
  } catch (error) {
    return next(error);
  }
});

function compareTripsForSearch(left, right) {
  const leftRank = getTripSearchRank(left);
  const rightRank = getTripSearchRank(right);

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  const leftDeparture = new Date(left.departureAt).getTime();
  const rightDeparture = new Date(right.departureAt).getTime();
  const leftTime = Number.isNaN(leftDeparture) ? 0 : leftDeparture;
  const rightTime = Number.isNaN(rightDeparture) ? 0 : rightDeparture;

  if (leftRank <= 1) {
    return leftTime - rightTime;
  }

  return rightTime - leftTime;
}

function getTripSearchRank(trip) {
  const availableSeats = Number(trip.availableSeats ?? 0);

  if (trip.isBookable && availableSeats > 0) {
    return 0;
  }

  if (trip.isBookable) {
    return 1;
  }

  if (trip.availabilityStatus === "departed") {
    return 2;
  }

  if (trip.availabilityStatus === "cancelled") {
    return 3;
  }

  return 4;
}

export default router;
