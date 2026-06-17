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
        latest.sale_end_at AS saleEndAt,
        trains.category AS trainCategory,
        origin_station.city AS originCity,
        destination_station.city AS destinationCity,
        route_metrics.distanceKm AS routeDistanceKm,
        route_metrics.stopCount AS routeStopCount
      FROM trips AS latest
      INNER JOIN routes ON routes.id = latest.route_id
      INNER JOIN trains ON trains.id = latest.train_id
      INNER JOIN stations AS origin_station ON origin_station.id = routes.origin_station_id
      INNER JOIN stations AS destination_station ON destination_station.id = routes.destination_station_id
      LEFT JOIN (
        SELECT
          route_id,
          MAX(distance_from_origin_km) AS distanceKm,
          COUNT(*) AS stopCount
        FROM route_stations
        GROUP BY route_id
      ) AS route_metrics ON route_metrics.route_id = latest.route_id
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
  const fallbackDurationMinutes = Math.max(45, Math.round(tripDurationMs / 60000));
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
    const todayPlan = buildGeneratedTripPlan(template, candidateDepartureToday, fallbackDurationMinutes);
    const candidateArrivalToday = addMinutes(candidateDepartureToday, todayPlan.durationMinutes);
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
      basePrice: todayPlan.basePrice,
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
      const tripPlan = buildGeneratedTripPlan(template, candidateDeparture, fallbackDurationMinutes);
      const candidateArrival = addMinutes(candidateDeparture, tripPlan.durationMinutes);
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
        basePrice: tripPlan.basePrice,
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

function buildGeneratedTripPlan(template, candidateDeparture, fallbackDurationMinutes) {
  const durationMinutes = computeRouteDurationMinutes({
    distanceKm: template.routeDistanceKm,
    stopCount: template.routeStopCount,
    trainCategory: template.trainCategory,
    originCity: template.originCity,
    destinationCity: template.destinationCity,
    candidateDeparture,
    fallbackDurationMinutes
  });

  const basePrice = computeRouteBasePrice({
    distanceKm: template.routeDistanceKm,
    stopCount: template.routeStopCount,
    trainCategory: template.trainCategory,
    originCity: template.originCity,
    destinationCity: template.destinationCity,
    candidateDeparture,
    durationMinutes,
    fallbackBasePrice: Number(template.basePrice)
  });

  return {
    durationMinutes,
    basePrice
  };
}

function computeRouteDurationMinutes({
  distanceKm,
  stopCount,
  trainCategory,
  originCity,
  destinationCity,
  candidateDeparture,
  fallbackDurationMinutes
}) {
  const fallback = Number.isFinite(fallbackDurationMinutes) && fallbackDurationMinutes > 0
    ? fallbackDurationMinutes
    : 240;
  const normalizedDistance = Number(distanceKm);

  if (!Number.isFinite(normalizedDistance) || normalizedDistance <= 0) {
    return roundToStep(fallback, 5);
  }

  const averageSpeedKph = getTrainCategorySpeed(trainCategory);
  const corridorSeed = buildCorridorSeed(originCity, destinationCity, trainCategory, candidateDeparture);
  const corridorFactor = 0.94 + (hashToUnit(`${corridorSeed}:duration`) * 0.18);
  const departureFactor = computeDepartureDurationFactor(candidateDeparture);
  const intermediateStops = Math.max(0, Number(stopCount ?? 0) - 2);
  const stopPenaltyMinutes = intermediateStops * (averageSpeedKph >= 85 ? 6 : 8);
  const turnaroundBufferMinutes = normalizedDistance >= 450 ? 22 : normalizedDistance >= 250 ? 16 : 10;
  const computedMinutes =
    ((normalizedDistance / averageSpeedKph) * 60 * corridorFactor * departureFactor) +
    stopPenaltyMinutes +
    turnaroundBufferMinutes;
  const blendedMinutes = (computedMinutes * 0.72) + (fallback * 0.28);

  return roundToStep(Math.max(45, blendedMinutes), 5);
}

function computeRouteBasePrice({
  distanceKm,
  stopCount,
  trainCategory,
  originCity,
  destinationCity,
  candidateDeparture,
  durationMinutes,
  fallbackBasePrice
}) {
  const fallback = Number.isFinite(fallbackBasePrice) && fallbackBasePrice > 0
    ? fallbackBasePrice
    : 250;
  const normalizedDistance = Number(distanceKm);
  const averageSpeedKph = getTrainCategorySpeed(trainCategory);
  const effectiveDistance = Number.isFinite(normalizedDistance) && normalizedDistance > 0
    ? normalizedDistance
    : Math.max(60, (durationMinutes / 60) * averageSpeedKph * 0.82);
  const corridorSeed = buildCorridorSeed(originCity, destinationCity, trainCategory, candidateDeparture);
  const cityDemandFactor = computeCityDemandFactor(originCity, destinationCity);
  const departureFactor = computeDeparturePriceFactor(candidateDeparture);
  const priceNoise = 0.93 + (hashToUnit(`${corridorSeed}:price`) * 0.16);
  const intermediateStops = Math.max(0, Number(stopCount ?? 0) - 2);
  const stopSurcharge = intermediateStops * 6;
  const computedBasePrice =
    (effectiveDistance * getTrainCategoryRatePerKm(trainCategory) * cityDemandFactor * departureFactor * priceNoise) +
    stopSurcharge;
  const blendedBasePrice = (computedBasePrice * 0.68) + (fallback * 0.32);

  return roundToStep(Math.max(80, blendedBasePrice), 10);
}

function getTrainCategorySpeed(category) {
  const normalized = normalizeDescriptor(category);

  if (normalized.includes("intercity") || normalized.includes("express") || normalized.includes("ic")) {
    return 92;
  }

  if (normalized.includes("night") || normalized.includes("sleeper") || normalized.includes("ніч")) {
    return 68;
  }

  if (normalized.includes("regional") || normalized.includes("регіон")) {
    return 58;
  }

  if (normalized.includes("fast") || normalized.includes("швид")) {
    return 78;
  }

  return 72;
}

function getTrainCategoryRatePerKm(category) {
  const normalized = normalizeDescriptor(category);

  if (normalized.includes("intercity") || normalized.includes("express") || normalized.includes("ic")) {
    return 1.12;
  }

  if (normalized.includes("night") || normalized.includes("sleeper") || normalized.includes("ніч")) {
    return 0.9;
  }

  if (normalized.includes("regional") || normalized.includes("регіон")) {
    return 0.72;
  }

  if (normalized.includes("fast") || normalized.includes("швид")) {
    return 0.98;
  }

  return 0.88;
}

function computeCityDemandFactor(originCity, destinationCity) {
  const originWeight = getCityWeight(originCity);
  const destinationWeight = getCityWeight(destinationCity);
  const corridorNoise = 0.97 + (hashToUnit(`${normalizeDescriptor(originCity)}:${normalizeDescriptor(destinationCity)}:demand`) * 0.12);

  return clamp((((originWeight + destinationWeight) / 2) * corridorNoise), 0.92, 1.28);
}

function getCityWeight(city) {
  const normalized = normalizeDescriptor(city);

  if (normalized.includes("київ") || normalized.includes("kyiv")) {
    return 1.16;
  }

  if (
    normalized.includes("львів") ||
    normalized.includes("lviv") ||
    normalized.includes("одеса") ||
    normalized.includes("odesa") ||
    normalized.includes("харків") ||
    normalized.includes("kharkiv") ||
    normalized.includes("дніпро") ||
    normalized.includes("dnipro")
  ) {
    return 1.11;
  }

  if (
    normalized.includes("вінниц") ||
    normalized.includes("vinnyts") ||
    normalized.includes("терноп") ||
    normalized.includes("ternop") ||
    normalized.includes("хмельниц") ||
    normalized.includes("khmel")
  ) {
    return 1.05;
  }

  return 1 + (hashToUnit(`${normalized}:city-weight`) * 0.04);
}

function computeDepartureDurationFactor(candidateDeparture) {
  const departure = new Date(candidateDeparture);
  const day = departure.getDay();
  const hour = departure.getHours();

  if (hour < 6 || hour >= 22) {
    return day === 5 || day === 6 ? 1.08 : 1.05;
  }

  if ((hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 20)) {
    return 0.98;
  }

  return 1;
}

function computeDeparturePriceFactor(candidateDeparture) {
  const departure = new Date(candidateDeparture);
  const day = departure.getDay();
  const hour = departure.getHours();

  let factor = 1;

  if (day === 5 || day === 0) {
    factor += 0.06;
  }

  if ((hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 21)) {
    factor += 0.04;
  } else if (hour < 6 || hour >= 22) {
    factor -= 0.03;
  }

  return clamp(factor, 0.92, 1.15);
}

function buildCorridorSeed(originCity, destinationCity, trainCategory, candidateDeparture) {
  return [
    normalizeDescriptor(originCity),
    normalizeDescriptor(destinationCity),
    normalizeDescriptor(trainCategory),
    formatDate(candidateDeparture)
  ].join(":");
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

function normalizeDescriptor(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function roundToStep(value, step) {
  if (!Number.isFinite(value)) {
    return step;
  }

  return Math.round(value / step) * step;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
