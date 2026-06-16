import { pool, query, withTransaction } from "../db/connection.js";
import { env } from "../config/env.js";
import { formatDateTimeForMySql, generateReference } from "../utils/bookingHelpers.js";

const SEARCHABLE_TRIP_STATUSES = ["scheduled", "completed"];
const SIMULATED_PASSWORD_HASH = "$2a$10$ACnqgRQ8i0ddgOIn9DDlbO.7syxGqy6AyeMvT5.AJgU1MQx9MDzQm";

export function getSearchableTripStatuses() {
  return SEARCHABLE_TRIP_STATUSES;
}

export function getTripAvailability(row, now = new Date()) {
  const departureAt = row?.departureAt ? new Date(row.departureAt) : null;
  const hasDeparted = departureAt instanceof Date && !Number.isNaN(departureAt.valueOf())
    ? departureAt <= now
    : false;
  const isCancelled = row?.status === "cancelled";
  const isCompleted = row?.status === "completed";
  const isBookable = !hasDeparted && !isCancelled && !isCompleted && row?.status === "scheduled";

  let availabilityStatus = "available";
  if (isCancelled || isCompleted || hasDeparted) {
    availabilityStatus = "departed";
  }
  if (isCancelled) {
    availabilityStatus = "cancelled";
  }

  return {
    hasDeparted,
    isBookable,
    availabilityStatus
  };
}

export async function completeDepartedTrips() {
  const now = formatDateTimeForMySql(new Date());
  const result = await query(
    `
      UPDATE trips
      SET status = 'completed',
          updated_at = CURRENT_TIMESTAMP
      WHERE status = 'scheduled'
        AND departure_datetime <= ?
    `,
    [now]
  );

  return result.affectedRows ?? 0;
}

export async function ensureUpcomingTrips() {
  const [templates] = await pool.execute(
    `
      SELECT
        latest.route_id AS routeId,
        latest.train_id AS trainId,
        latest.trip_code AS tripCode,
        latest.departure_datetime AS departureAt,
        latest.arrival_datetime AS arrivalAt,
        latest.base_price AS basePrice,
        latest.sale_start_at AS saleStartAt,
        latest.sale_end_at AS saleEndAt
      FROM trips AS latest
      INNER JOIN (
        SELECT route_id, train_id, MAX(departure_datetime) AS latestDepartureAt
        FROM trips
        WHERE status IN ('scheduled', 'completed')
        GROUP BY route_id, train_id
      ) AS grouped
        ON grouped.route_id = latest.route_id
       AND grouped.train_id = latest.train_id
       AND grouped.latestDepartureAt = latest.departure_datetime
    `
  );

  let createdCount = 0;

  for (const template of templates) {
    createdCount += await ensureUpcomingTripsForTemplate(template);
  }

  return createdCount;
}

export async function ensureTripDemandCoverage() {
  if (!env.tripAutofillEnabled) {
    return 0;
  }

  const passengerIds = await ensureSimulatedPassengers();
  if (passengerIds.length === 0) {
    return 0;
  }

  const [trips] = await pool.execute(
    `
      SELECT
        trips.id,
        trips.trip_code AS tripCode,
        trips.departure_datetime AS departureAt,
        trips.arrival_datetime AS arrivalAt,
        trips.base_price AS basePrice
      FROM trips
      WHERE trips.status = 'scheduled'
        AND trips.departure_datetime > NOW()
        AND trips.departure_datetime <= DATE_ADD(NOW(), INTERVAL ? DAY)
      ORDER BY trips.departure_datetime ASC
    `,
    [Math.max(1, env.tripGenerationHorizonDays)]
  );

  let insertedBookings = 0;

  for (const trip of trips) {
    insertedBookings += await ensureTripOccupancy(trip, passengerIds);
  }

  return insertedBookings;
}

async function ensureUpcomingTripsForTemplate(template) {
  const now = new Date();
  const todayKey = formatDate(now);
  const horizonEnd = endOfDay(addDays(now, Math.max(1, env.tripGenerationHorizonDays)));
  const templateDeparture = new Date(template.departureAt);
  const templateArrival = new Date(template.arrivalAt);
  const templateSaleStart = template.saleStartAt ? new Date(template.saleStartAt) : null;
  const templateSaleEnd = template.saleEndAt ? new Date(template.saleEndAt) : null;

  if (Number.isNaN(templateDeparture.valueOf()) || Number.isNaN(templateArrival.valueOf())) {
    return 0;
  }

  const tripDurationMs = templateArrival.getTime() - templateDeparture.getTime();
  const saleStartLeadMs = templateSaleStart
    ? templateDeparture.getTime() - templateSaleStart.getTime()
    : null;
  const saleEndLeadMs = templateSaleEnd
    ? templateDeparture.getTime() - templateSaleEnd.getTime()
    : null;

  const [existingRows] = await pool.execute(
    `
      SELECT departure_datetime AS departureAt
      FROM trips
      WHERE route_id = ?
        AND train_id = ?
        AND departure_datetime >= ?
        AND departure_datetime <= ?
      ORDER BY departure_datetime ASC
    `,
    [
      template.routeId,
      template.trainId,
      formatDateTimeForMySql(startOfDay(now)),
      formatDateTimeForMySql(horizonEnd)
    ]
  );

  const existingDepartures = existingRows.map((row) => new Date(row.departureAt));
  const existingKeys = new Set(
    existingDepartures
      .filter((departureAt) => formatDate(departureAt) !== todayKey)
      .map((departureAt) => formatDate(departureAt))
  );
  let candidateDeparture = alignCandidateDeparture(templateDeparture, now);
  let createdCount = 0;

  if (!hasBookableTripToday(existingDepartures, now)) {
    const candidateDepartureToday = buildCatchupDeparture(now, templateDeparture);
    const candidateArrivalToday = new Date(candidateDepartureToday.getTime() + tripDurationMs);
    const candidateSaleStartToday = saleStartLeadMs === null
      ? null
      : new Date(candidateDepartureToday.getTime() - saleStartLeadMs);
    const candidateSaleEndToday = saleEndLeadMs === null
      ? null
      : new Date(candidateDepartureToday.getTime() - saleEndLeadMs);

    const createdToday = await insertGeneratedTripIfMissing({
      routeId: template.routeId,
      trainId: template.trainId,
      sourceTripCode: template.tripCode,
      candidateDeparture: candidateDepartureToday,
      candidateArrival: candidateArrivalToday,
      basePrice: template.basePrice,
      candidateSaleStart: candidateSaleStartToday,
      candidateSaleEnd: candidateSaleEndToday
    });

    if (createdToday) {
      createdCount += 1;
    }
  }

  while (candidateDeparture <= horizonEnd) {
    const dayKey = formatDate(candidateDeparture);

    if (dayKey !== todayKey && !existingKeys.has(dayKey)) {
      const candidateArrival = new Date(candidateDeparture.getTime() + tripDurationMs);
      const candidateSaleStart = saleStartLeadMs === null
        ? null
        : new Date(candidateDeparture.getTime() - saleStartLeadMs);
      const candidateSaleEnd = saleEndLeadMs === null
        ? null
        : new Date(candidateDeparture.getTime() - saleEndLeadMs);

      const created = await insertGeneratedTripIfMissing({
        routeId: template.routeId,
        trainId: template.trainId,
        sourceTripCode: template.tripCode,
        candidateDeparture,
        candidateArrival,
        basePrice: template.basePrice,
        candidateSaleStart,
        candidateSaleEnd
      });

      if (created) {
        createdCount += 1;
        existingKeys.add(dayKey);
      }
    }

    candidateDeparture = addDays(candidateDeparture, 1);
  }

  return createdCount;
}

async function insertGeneratedTripIfMissing({
  routeId,
  trainId,
  sourceTripCode,
  candidateDeparture,
  candidateArrival,
  basePrice,
  candidateSaleStart,
  candidateSaleEnd
}) {
  return withTransaction(async (connection) => {
    const departureSql = formatDateTimeForMySql(candidateDeparture);

    const [samePairRows] = await connection.execute(
      `
        SELECT id
        FROM trips
        WHERE route_id = ?
          AND train_id = ?
          AND departure_datetime = ?
        LIMIT 1
        FOR UPDATE
      `,
      [routeId, trainId, departureSql]
    );

    if (samePairRows.length > 0) {
      return false;
    }

    const tripCode = buildGeneratedTripCode(sourceTripCode, candidateDeparture);

    await connection.execute(
      `
        INSERT INTO trips (
          route_id,
          train_id,
          trip_code,
          departure_datetime,
          arrival_datetime,
          base_price,
          status,
          sale_start_at,
          sale_end_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)
      `,
      [
        routeId,
        trainId,
        tripCode,
        departureSql,
        formatDateTimeForMySql(candidateArrival),
        basePrice,
        candidateSaleStart ? formatDateTimeForMySql(candidateSaleStart) : null,
        candidateSaleEnd ? formatDateTimeForMySql(candidateSaleEnd) : null
      ]
    );

    return true;
  });
}

async function ensureSimulatedPassengers() {
  const desiredCount = Math.max(1, env.tripAutofillPassengerPoolSize);
  const [roleRows] = await pool.execute(
    `
      SELECT id
      FROM roles
      WHERE code = 'passenger'
      LIMIT 1
    `
  );

  const passengerRoleId = roleRows[0]?.id;
  if (!passengerRoleId) {
    return [];
  }

  const createdIds = [];

  for (let index = 1; index <= desiredCount; index += 1) {
    const suffix = String(index).padStart(2, "0");
    const username = `sim_passenger_${suffix}`;
    const email = `${username}@example.local`;
    const fullName = `Автопасажир ${suffix}`;
    const phone = `+380500100${suffix}`;

    const [existingRows] = await pool.execute(
      `
        SELECT id
        FROM users
        WHERE username = ?
        LIMIT 1
      `,
      [username]
    );

    if (existingRows[0]?.id) {
      createdIds.push(existingRows[0].id);
      continue;
    }

    const [insertResult] = await pool.execute(
      `
        INSERT INTO users (
          role_id,
          username,
          email,
          phone,
          full_name,
          password_hash,
          is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `,
      [passengerRoleId, username, email, phone, fullName, SIMULATED_PASSWORD_HASH]
    );

    createdIds.push(insertResult.insertId);
  }

  return createdIds;
}

async function ensureTripOccupancy(trip, passengerIds) {
  const departureAt = new Date(trip.departureAt);
  if (Number.isNaN(departureAt.valueOf())) {
    return 0;
  }

  const [seatRows] = await pool.execute(
    `
      SELECT
        seats.id AS seatId,
        seats.seat_number AS seatNumber,
        seats.seat_type AS seatType,
        carriages.id AS carriageId,
        carriages.carriage_type AS carriageType,
        carriages.class_code AS carriageClassCode,
        carriages.carriage_number AS carriageNumber
      FROM trips
      INNER JOIN trains ON trains.id = trips.train_id
      INNER JOIN carriages ON carriages.train_id = trains.id AND carriages.is_active = 1
      INNER JOIN seats ON seats.carriage_id = carriages.id AND seats.is_active = 1
      WHERE trips.id = ?
      ORDER BY carriages.carriage_number ASC, seats.seat_number ASC
    `,
    [trip.id]
  );

  const totalSeats = seatRows.length;
  if (totalSeats === 0) {
    return 0;
  }

  const [activeRows] = await pool.execute(
    `
      SELECT
        bookings.id,
        bookings.status,
        bookings.seat_id AS seatId
      FROM bookings
      WHERE bookings.trip_id = ?
        AND (
          bookings.status = 'paid'
          OR (
            bookings.status = 'reserved'
            AND bookings.reserved_until IS NOT NULL
            AND bookings.reserved_until > NOW()
          )
        )
    `,
    [trip.id]
  );

  const activeSeatIds = new Set(activeRows.map((row) => row.seatId));
  const activeCount = activeSeatIds.size;
  const targetLoad = computeTargetLoadFactor(trip, seatRows);
  const targetActiveSeats = Math.max(0, Math.min(totalSeats - 1, Math.round(totalSeats * targetLoad)));

  if (activeCount >= targetActiveSeats) {
    return 0;
  }

  const freeSeats = shuffleWithSeed(
    seatRows.filter((seat) => !activeSeatIds.has(seat.seatId)),
    `${trip.tripCode}:seat-order`
  );
  const seatsToCreate = Math.min(freeSeats.length, targetActiveSeats - activeCount);

  if (seatsToCreate <= 0) {
    return 0;
  }

  return withTransaction(async (connection) => {
    const now = new Date();
    let insertedCount = 0;

    for (let index = 0; index < seatsToCreate; index += 1) {
      const seat = freeSeats[index];
      const passengerId = passengerIds[pickPassengerIndex(trip, passengerIds.length, index)];
      const status = pickSimulatedStatus(trip, seat, index, seatsToCreate);
      const bookingNumber = generateReference("BK");
      const [passengerRows] = await connection.execute(
        `
          SELECT id, full_name
          FROM users
          WHERE id = ?
          LIMIT 1
        `,
        [passengerId]
      );

      const passenger = passengerRows[0];
      if (!passenger) {
        continue;
      }

      const paidAt = status === "paid" ? formatDateTimeForMySql(now) : null;
      const reservedUntil = status === "reserved"
        ? formatDateTimeForMySql(addMinutes(now, 15 + ((trip.id + index) % 30)))
        : null;

      const [bookingResult] = await connection.execute(
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
            paid_at,
            total_price
          )
          VALUES (?, ?, ?, ?, ?, NULL, ?, 'passenger', ?, ?, ?, ?)
        `,
        [
          bookingNumber,
          trip.id,
          seat.carriageId,
          seat.seatId,
          passenger.id,
          passenger.full_name,
          status,
          reservedUntil,
          paidAt,
          trip.basePrice
        ]
      );

      if (status === "paid") {
        const paymentReference = generateReference("PAY");
        const ticketNumber = generateReference("TK");

        await connection.execute(
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
            VALUES (?, NULL, ?, 'demo', 'succeeded', ?, ?)
          `,
          [bookingResult.insertId, paymentReference, trip.basePrice, paidAt]
        );

        await connection.execute(
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
          [bookingResult.insertId, ticketNumber, paidAt, ticketNumber]
        );
      }

      insertedCount += 1;
    }

    return insertedCount;
  });
}

function computeTargetLoadFactor(trip, totalSeats) {
  const minLoad = clamp(env.tripAutofillMinLoad, 0.05, 0.85);
  const maxLoad = clamp(env.tripAutofillMaxLoad, minLoad, 0.95);
  const now = Date.now();
  const departureAt = new Date(trip.departureAt).getTime();
  const daysUntilDeparture = Math.max(0, (departureAt - now) / (24 * 60 * 60 * 1000));
  const horizon = Math.max(1, env.tripGenerationHorizonDays);
  const proximity = clamp(1 - daysUntilDeparture / horizon, 0, 1);
  const deterministicNoise = hashToUnit(`${trip.tripCode}:${trip.basePrice}`);
  const carriageMixBonus = computeCarriageMixBonus(totalSeats);
  const timeOfDayBonus = computeTimeOfDayBonus(trip.departureAt);

  return clamp(
    minLoad + (maxLoad - minLoad) * (0.24 + proximity * 0.34 + deterministicNoise * 0.24 + carriageMixBonus * 0.1 + timeOfDayBonus * 0.08),
    minLoad,
    maxLoad
  );
}

function pickSimulatedStatus(trip, seat, seatIndex, seatsToCreate) {
  const baseShare = clamp(env.tripAutofillReservedShare, 0, 0.6);
  const proximity = clamp(1 - ((new Date(trip.departureAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000 * Math.max(1, env.tripGenerationHorizonDays))), 0, 1);
  const seatBias = hashToUnit(`${trip.tripCode}:${seat.carriageNumber}:${seat.seatNumber}:status`);
  const reservedShare = clamp(baseShare + proximity * 0.1 + seatBias * 0.18 - seatClassPaidBias(seat) * 0.08, 0, 0.7);
  const progress = seatsToCreate <= 1 ? 1 : seatIndex / (seatsToCreate - 1);

  return progress < reservedShare ? "reserved" : "paid";
}

function computeCarriageMixBonus(seats) {
  const weights = seats.map((seat) => seatDemandWeight(seat));
  const average = weights.length === 0
    ? 0.5
    : weights.reduce((sum, value) => sum + value, 0) / weights.length;

  return clamp(average, 0, 1);
}

function computeTimeOfDayBonus(departureAt) {
  const hours = new Date(departureAt).getHours();

  if ((hours >= 6 && hours <= 9) || (hours >= 17 && hours <= 21)) {
    return 0.9;
  }

  if (hours >= 10 && hours <= 16) {
    return 0.6;
  }

  return 0.35;
}

function seatDemandWeight(seat) {
  const type = String(seat.carriageType ?? "").toLowerCase();
  const classCode = String(seat.carriageClassCode ?? "").toLowerCase();
  const seatType = String(seat.seatType ?? "").toLowerCase();

  let weight = 0.5;

  if (classCode === "first" || type === "lux") weight += 0.18;
  if (classCode === "second" || type === "coupe") weight += 0.08;
  if (type === "platzkart") weight -= 0.02;
  if (seatType.includes("lower")) weight += 0.08;
  if (seatType.includes("upper")) weight -= 0.04;
  if (seatType.includes("side")) weight -= 0.07;

  weight += (hashToUnit(`${seat.carriageNumber}:${seat.seatNumber}:weight`) - 0.5) * 0.18;

  return clamp(weight, 0.12, 0.92);
}

function seatClassPaidBias(seat) {
  const seatType = String(seat.seatType ?? "").toLowerCase();

  if (seatType.includes("lower")) return 0.9;
  if (seatType.includes("upper")) return 0.45;
  if (seatType.includes("side-lower")) return 0.35;
  if (seatType.includes("side-upper")) return 0.2;

  return 0.55;
}

function pickPassengerIndex(trip, passengerCount, seatIndex) {
  if (passengerCount <= 1) {
    return 0;
  }

  const base = Math.floor(hashToUnit(`${trip.tripCode}:passenger:${seatIndex}`) * passengerCount);
  return clamp(base, 0, passengerCount - 1);
}

function shuffleWithSeed(items, seed) {
  const list = [...items];

  for (let index = list.length - 1; index > 0; index -= 1) {
    const rand = hashToUnit(`${seed}:${index}:${list[index]?.seatId ?? index}`);
    const swapIndex = Math.floor(rand * (index + 1));
    [list[index], list[swapIndex]] = [list[swapIndex], list[index]];
  }

  return list;
}

function buildGeneratedTripCode(sourceTripCode, departureAt) {
  const datePart = formatDate(departureAt);
  const baseCode = String(sourceTripCode ?? "TRIP").replace(/-\d{8}(?:-[A-Z0-9]+)?$/i, "");
  const timePart = `${String(departureAt.getHours()).padStart(2, "0")}${String(departureAt.getMinutes()).padStart(2, "0")}`;
  return `${baseCode}-${datePart}-${timePart}`;
}

function alignCandidateDeparture(templateDeparture, now) {
  const candidate = new Date(templateDeparture);
  while (candidate <= now) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

function hasBookableTripToday(existingDepartures, now) {
  const todayKey = formatDate(now);
  return existingDepartures.some((departureAt) => (
    formatDate(departureAt) === todayKey && departureAt > now
  ));
}

function buildCatchupDeparture(now, templateDeparture) {
  const candidate = new Date(now);
  const templateMinutes = (templateDeparture.getHours() * 60) + templateDeparture.getMinutes();
  const nowMinutes = (now.getHours() * 60) + now.getMinutes();
  const roundedMinutes = Math.ceil((nowMinutes + 90) / 15) * 15;
  const targetMinutes = Math.max(templateMinutes, roundedMinutes);

  candidate.setSeconds(0, 0);
  candidate.setHours(Math.floor(targetMinutes / 60), targetMinutes % 60, 0, 0);

  if (candidate <= now) {
    candidate.setMinutes(candidate.getMinutes() + 30);
  }

  return candidate;
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMinutes(date, minutes) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function hashToUnit(value) {
  let hash = 0;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash % 1000) / 1000;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
