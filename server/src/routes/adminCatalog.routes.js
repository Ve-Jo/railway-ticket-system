import { Router } from "express";
import { query, withTransaction } from "../db/connection.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

router.use(requireRole("admin"));

router.get("/stations", async (req, res, next) => {
  try {
    const search = String(req.query.search ?? "").trim();
    const includeInactive = parseBooleanFlag(req.query.includeInactive);
    const filters = [];
    const params = [];

    if (search) {
      filters.push("(code LIKE ? OR name LIKE ? OR city LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (!includeInactive) {
      filters.push("is_active = 1");
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const items = await query(
      `
        SELECT
          id,
          code,
          name,
          city,
          address,
          is_active AS isActive,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM stations
        ${whereClause}
        ORDER BY name ASC, city ASC
      `,
      params
    );

    return res.json({ items });
  } catch (error) {
    return next(error);
  }
});

router.post("/stations", async (req, res, next) => {
  try {
    const payload = normalizeStationPayload(req.body, { partial: false });
    if (!payload.ok) {
      return res.status(422).json({ message: payload.message });
    }

    const existing = await query(
      `
        SELECT id
        FROM stations
        WHERE code = ?
           OR (name = ? AND city = ?)
        LIMIT 1
      `,
      [payload.value.code, payload.value.name, payload.value.city]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: "Station with the same code or name/city already exists"
      });
    }

    const result = await query(
      `
        INSERT INTO stations (code, name, city, address, is_active)
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        payload.value.code,
        payload.value.name,
        payload.value.city,
        payload.value.address,
        payload.value.isActive
      ]
    );

    const station = await getStationById(result.insertId);
    return res.status(201).json({ station });
  } catch (error) {
    return next(error);
  }
});

router.patch("/stations/:stationId", async (req, res, next) => {
  try {
    const stationId = parsePositiveInt(req.params.stationId);
    if (!stationId) {
      return res.status(422).json({ message: "stationId must be a positive integer" });
    }

    const payload = normalizeStationPayload(req.body, { partial: true });
    if (!payload.ok) {
      return res.status(422).json({ message: payload.message });
    }

    if (Object.keys(payload.value).length === 0) {
      return res.status(422).json({ message: "No station fields provided for update" });
    }

    const currentStation = await getStationById(stationId);
    if (!currentStation) {
      return res.status(404).json({ message: "Station not found" });
    }

    const merged = {
      code: payload.value.code ?? currentStation.code,
      name: payload.value.name ?? currentStation.name,
      city: payload.value.city ?? currentStation.city,
      address: Object.prototype.hasOwnProperty.call(payload.value, "address")
        ? payload.value.address
        : currentStation.address,
      isActive: Object.prototype.hasOwnProperty.call(payload.value, "isActive")
        ? payload.value.isActive
        : currentStation.isActive
    };

    const duplicates = await query(
      `
        SELECT id
        FROM stations
        WHERE id <> ?
          AND (code = ? OR (name = ? AND city = ?))
        LIMIT 1
      `,
      [stationId, merged.code, merged.name, merged.city]
    );

    if (duplicates.length > 0) {
      return res.status(409).json({
        message: "Station with the same code or name/city already exists"
      });
    }

    await query(
      `
        UPDATE stations
        SET code = ?, name = ?, city = ?, address = ?, is_active = ?
        WHERE id = ?
      `,
      [merged.code, merged.name, merged.city, merged.address, merged.isActive, stationId]
    );

    const station = await getStationById(stationId);
    return res.json({ station });
  } catch (error) {
    return next(error);
  }
});

router.delete("/stations/:stationId", async (req, res, next) => {
  try {
    const stationId = parsePositiveInt(req.params.stationId);
    if (!stationId) {
      return res.status(422).json({ message: "stationId must be a positive integer" });
    }

    const currentStation = await getStationById(stationId);
    if (!currentStation) {
      return res.status(404).json({ message: "Station not found" });
    }

    await query("UPDATE stations SET is_active = 0 WHERE id = ?", [stationId]);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.get("/routes", async (req, res, next) => {
  try {
    const includeInactive = parseBooleanFlag(req.query.includeInactive);
    const items = await query(
      `
        SELECT
          routes.id,
          routes.code,
          routes.name,
          routes.origin_station_id AS originStationId,
          routes.destination_station_id AS destinationStationId,
          origin_station.name AS originStationName,
          destination_station.name AS destinationStationName,
          routes.is_active AS isActive,
          routes.created_at AS createdAt,
          routes.updated_at AS updatedAt,
          COALESCE(
            CONCAT(
              '[',
              GROUP_CONCAT(
                CASE
                  WHEN route_stations.id IS NULL THEN NULL
                  ELSE JSON_OBJECT(
                    'id', route_stations.id,
                    'stationId', route_stations.station_id,
                    'stationName', route_station_catalog.name,
                    'stopOrder', route_stations.stop_order,
                    'arrivalOffsetMinutes', route_stations.arrival_offset_minutes,
                    'departureOffsetMinutes', route_stations.departure_offset_minutes,
                    'stopDurationMinutes', route_stations.stop_duration_minutes,
                    'distanceFromOriginKm', route_stations.distance_from_origin_km
                  )
                END
                ORDER BY route_stations.stop_order ASC
                SEPARATOR ','
              ),
              ']'
            ),
            '[]'
          ) AS stops
        FROM routes
        INNER JOIN stations AS origin_station ON origin_station.id = routes.origin_station_id
        INNER JOIN stations AS destination_station ON destination_station.id = routes.destination_station_id
        LEFT JOIN route_stations ON route_stations.route_id = routes.id
        LEFT JOIN stations AS route_station_catalog ON route_station_catalog.id = route_stations.station_id
        WHERE (? = 1 OR routes.is_active = 1)
        GROUP BY
          routes.id,
          routes.code,
          routes.name,
          routes.origin_station_id,
          routes.destination_station_id,
          origin_station.name,
          destination_station.name,
          routes.is_active,
          routes.created_at,
          routes.updated_at
        ORDER BY routes.code ASC
      `,
      [includeInactive ? 1 : 0]
    );

    return res.json({
      items: items.map(mapRouteRow)
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/routes", async (req, res, next) => {
  try {
    const payload = normalizeRoutePayload(req.body, { partial: false });
    if (!payload.ok) {
      return res.status(422).json({ message: payload.message });
    }

    const stationIds = uniqueIds([
      payload.value.originStationId,
      payload.value.destinationStationId,
      ...payload.value.stops.map((stop) => stop.stationId)
    ]);

    const validation = await validateRouteDependencies({
      routeId: null,
      code: payload.value.code,
      stationIds
    });

    if (!validation.ok) {
      return res.status(validation.status).json({ message: validation.message });
    }

    const routeId = await withTransaction(async (connection) => {
      const [insertResult] = await connection.execute(
        `
          INSERT INTO routes (code, name, origin_station_id, destination_station_id, is_active)
          VALUES (?, ?, ?, ?, ?)
        `,
        [
          payload.value.code,
          payload.value.name,
          payload.value.originStationId,
          payload.value.destinationStationId,
          payload.value.isActive
        ]
      );

      await replaceRouteStops(connection, insertResult.insertId, payload.value.stops);
      return insertResult.insertId;
    });

    const route = await getRouteById(routeId);
    return res.status(201).json({ route });
  } catch (error) {
    return next(error);
  }
});

router.patch("/routes/:routeId", async (req, res, next) => {
  try {
    const routeId = parsePositiveInt(req.params.routeId);
    if (!routeId) {
      return res.status(422).json({ message: "routeId must be a positive integer" });
    }

    const payload = normalizeRoutePayload(req.body, { partial: true });
    if (!payload.ok) {
      return res.status(422).json({ message: payload.message });
    }

    if (Object.keys(payload.value).length === 0) {
      return res.status(422).json({ message: "No route fields provided for update" });
    }

    const currentRoute = await getRouteById(routeId);
    if (!currentRoute) {
      return res.status(404).json({ message: "Route not found" });
    }

    const mergedStops = payload.value.stops ?? currentRoute.stops.map((stop) => ({
      stationId: stop.stationId,
      stopOrder: stop.stopOrder,
      arrivalOffsetMinutes: stop.arrivalOffsetMinutes,
      departureOffsetMinutes: stop.departureOffsetMinutes,
      stopDurationMinutes: stop.stopDurationMinutes,
      distanceFromOriginKm: stop.distanceFromOriginKm
    }));

    const merged = {
      code: payload.value.code ?? currentRoute.code,
      name: payload.value.name ?? currentRoute.name,
      originStationId: payload.value.originStationId ?? currentRoute.originStationId,
      destinationStationId:
        payload.value.destinationStationId ?? currentRoute.destinationStationId,
      isActive: Object.prototype.hasOwnProperty.call(payload.value, "isActive")
        ? payload.value.isActive
        : currentRoute.isActive,
      stops: mergedStops
    };

    const routeShapeValidation = validateRouteShape(
      merged.originStationId,
      merged.destinationStationId,
      merged.stops
    );
    if (!routeShapeValidation.ok) {
      return res.status(422).json({ message: routeShapeValidation.message });
    }

    const stationIds = uniqueIds([
      merged.originStationId,
      merged.destinationStationId,
      ...merged.stops.map((stop) => stop.stationId)
    ]);

    const validation = await validateRouteDependencies({
      routeId,
      code: merged.code,
      stationIds
    });

    if (!validation.ok) {
      return res.status(validation.status).json({ message: validation.message });
    }

    await withTransaction(async (connection) => {
      await connection.execute(
        `
          UPDATE routes
          SET code = ?, name = ?, origin_station_id = ?, destination_station_id = ?, is_active = ?
          WHERE id = ?
        `,
        [
          merged.code,
          merged.name,
          merged.originStationId,
          merged.destinationStationId,
          merged.isActive,
          routeId
        ]
      );

      if (payload.value.stops) {
        await replaceRouteStops(connection, routeId, merged.stops);
      }
    });

    const route = await getRouteById(routeId);
    return res.json({ route });
  } catch (error) {
    return next(error);
  }
});

router.delete("/routes/:routeId", async (req, res, next) => {
  try {
    const routeId = parsePositiveInt(req.params.routeId);
    if (!routeId) {
      return res.status(422).json({ message: "routeId must be a positive integer" });
    }

    const currentRoute = await getRouteById(routeId);
    if (!currentRoute) {
      return res.status(404).json({ message: "Route not found" });
    }

    await query("UPDATE routes SET is_active = 0 WHERE id = ?", [routeId]);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.get("/trips", async (req, res, next) => {
  try {
    const status = String(req.query.status ?? "").trim();
    const routeId = req.query.routeId === undefined ? null : parsePositiveInt(req.query.routeId);
    const trainId = req.query.trainId === undefined ? null : parsePositiveInt(req.query.trainId);
    const date = String(req.query.date ?? "").trim();
    const filters = [];
    const params = [];

    if (status) {
      if (!["scheduled", "cancelled", "completed"].includes(status)) {
        return res.status(422).json({ message: "status must be scheduled, cancelled, or completed" });
      }

      filters.push("trips.status = ?");
      params.push(status);
    }

    if (req.query.routeId !== undefined) {
      if (!routeId) {
        return res.status(422).json({ message: "routeId must be a positive integer" });
      }

      filters.push("trips.route_id = ?");
      params.push(routeId);
    }

    if (req.query.trainId !== undefined) {
      if (!trainId) {
        return res.status(422).json({ message: "trainId must be a positive integer" });
      }

      filters.push("trips.train_id = ?");
      params.push(trainId);
    }

    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(422).json({ message: "date must be in YYYY-MM-DD format" });
      }

      filters.push("trips.departure_date = ?");
      params.push(date);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
    const items = await query(
      `
        SELECT
          trips.id,
          trips.route_id AS routeId,
          trips.train_id AS trainId,
          trips.trip_code AS tripCode,
          trips.departure_datetime AS departureAt,
          trips.arrival_datetime AS arrivalAt,
          trips.base_price AS basePrice,
          trips.status,
          trips.sale_start_at AS saleStartAt,
          trips.sale_end_at AS saleEndAt,
          routes.code AS routeCode,
          routes.name AS routeName,
          origin_station.name AS originStationName,
          destination_station.name AS destinationStationName,
          trains.code AS trainCode,
          trains.name AS trainName
        FROM trips
        INNER JOIN routes ON routes.id = trips.route_id
        INNER JOIN stations AS origin_station ON origin_station.id = routes.origin_station_id
        INNER JOIN stations AS destination_station ON destination_station.id = routes.destination_station_id
        INNER JOIN trains ON trains.id = trips.train_id
        ${whereClause}
        ORDER BY trips.departure_datetime DESC
      `,
      params
    );

    return res.json({ items });
  } catch (error) {
    return next(error);
  }
});

router.post("/trips", async (req, res, next) => {
  try {
    const payload = normalizeTripPayload(req.body, { partial: false });
    if (!payload.ok) {
      return res.status(422).json({ message: payload.message });
    }

    const validation = await validateTripDependencies({
      tripId: null,
      routeId: payload.value.routeId,
      trainId: payload.value.trainId,
      tripCode: payload.value.tripCode
    });

    if (!validation.ok) {
      return res.status(validation.status).json({ message: validation.message });
    }

    const result = await query(
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.value.routeId,
        payload.value.trainId,
        payload.value.tripCode,
        payload.value.departureAt,
        payload.value.arrivalAt,
        payload.value.basePrice,
        payload.value.status,
        payload.value.saleStartAt,
        payload.value.saleEndAt
      ]
    );

    const trip = await getTripById(result.insertId);
    return res.status(201).json({ trip });
  } catch (error) {
    return next(error);
  }
});

router.patch("/trips/:tripId", async (req, res, next) => {
  try {
    const tripId = parsePositiveInt(req.params.tripId);
    if (!tripId) {
      return res.status(422).json({ message: "tripId must be a positive integer" });
    }

    const payload = normalizeTripPayload(req.body, { partial: true });
    if (!payload.ok) {
      return res.status(422).json({ message: payload.message });
    }

    if (Object.keys(payload.value).length === 0) {
      return res.status(422).json({ message: "No trip fields provided for update" });
    }

    const currentTrip = await getTripById(tripId);
    if (!currentTrip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    const merged = {
      routeId: payload.value.routeId ?? currentTrip.routeId,
      trainId: payload.value.trainId ?? currentTrip.trainId,
      tripCode: payload.value.tripCode ?? currentTrip.tripCode,
      departureAt: payload.value.departureAt ?? currentTrip.departureAt,
      arrivalAt: payload.value.arrivalAt ?? currentTrip.arrivalAt,
      basePrice: Object.prototype.hasOwnProperty.call(payload.value, "basePrice")
        ? payload.value.basePrice
        : currentTrip.basePrice,
      status: payload.value.status ?? currentTrip.status,
      saleStartAt: Object.prototype.hasOwnProperty.call(payload.value, "saleStartAt")
        ? payload.value.saleStartAt
        : currentTrip.saleStartAt,
      saleEndAt: Object.prototype.hasOwnProperty.call(payload.value, "saleEndAt")
        ? payload.value.saleEndAt
        : currentTrip.saleEndAt
    };

    const dateValidation = validateTripDateRules(merged);
    if (!dateValidation.ok) {
      return res.status(422).json({ message: dateValidation.message });
    }

    const dependencyValidation = await validateTripDependencies({
      tripId,
      routeId: merged.routeId,
      trainId: merged.trainId,
      tripCode: merged.tripCode
    });

    if (!dependencyValidation.ok) {
      return res.status(dependencyValidation.status).json({ message: dependencyValidation.message });
    }

    await query(
      `
        UPDATE trips
        SET
          route_id = ?,
          train_id = ?,
          trip_code = ?,
          departure_datetime = ?,
          arrival_datetime = ?,
          base_price = ?,
          status = ?,
          sale_start_at = ?,
          sale_end_at = ?
        WHERE id = ?
      `,
      [
        merged.routeId,
        merged.trainId,
        merged.tripCode,
        merged.departureAt,
        merged.arrivalAt,
        merged.basePrice,
        merged.status,
        merged.saleStartAt,
        merged.saleEndAt,
        tripId
      ]
    );

    const trip = await getTripById(tripId);
    return res.json({ trip });
  } catch (error) {
    return next(error);
  }
});

router.delete("/trips/:tripId", async (req, res, next) => {
  try {
    const tripId = parsePositiveInt(req.params.tripId);
    if (!tripId) {
      return res.status(422).json({ message: "tripId must be a positive integer" });
    }

    const currentTrip = await getTripById(tripId);
    if (!currentTrip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    await query("UPDATE trips SET status = 'cancelled' WHERE id = ?", [tripId]);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

async function getStationById(stationId) {
  const rows = await query(
    `
      SELECT
        id,
        code,
        name,
        city,
        address,
        is_active AS isActive,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM stations
      WHERE id = ?
      LIMIT 1
    `,
    [stationId]
  );

  return rows[0] ?? null;
}

async function getRouteById(routeId) {
  const rows = await query(
    `
      SELECT
        routes.id,
        routes.code,
        routes.name,
        routes.origin_station_id AS originStationId,
        routes.destination_station_id AS destinationStationId,
        origin_station.name AS originStationName,
        destination_station.name AS destinationStationName,
        routes.is_active AS isActive,
        routes.created_at AS createdAt,
        routes.updated_at AS updatedAt,
        COALESCE(
          CONCAT(
            '[',
            GROUP_CONCAT(
              CASE
                WHEN route_stations.id IS NULL THEN NULL
                ELSE JSON_OBJECT(
                  'id', route_stations.id,
                  'stationId', route_stations.station_id,
                  'stationName', route_station_catalog.name,
                  'stopOrder', route_stations.stop_order,
                  'arrivalOffsetMinutes', route_stations.arrival_offset_minutes,
                  'departureOffsetMinutes', route_stations.departure_offset_minutes,
                  'stopDurationMinutes', route_stations.stop_duration_minutes,
                  'distanceFromOriginKm', route_stations.distance_from_origin_km
                )
              END
              ORDER BY route_stations.stop_order ASC
              SEPARATOR ','
            ),
            ']'
          ),
          '[]'
        ) AS stops
      FROM routes
      INNER JOIN stations AS origin_station ON origin_station.id = routes.origin_station_id
      INNER JOIN stations AS destination_station ON destination_station.id = routes.destination_station_id
      LEFT JOIN route_stations ON route_stations.route_id = routes.id
      LEFT JOIN stations AS route_station_catalog ON route_station_catalog.id = route_stations.station_id
      WHERE routes.id = ?
      GROUP BY
        routes.id,
        routes.code,
        routes.name,
        routes.origin_station_id,
        routes.destination_station_id,
        origin_station.name,
        destination_station.name,
        routes.is_active,
        routes.created_at,
        routes.updated_at
      LIMIT 1
    `,
    [routeId]
  );

  return rows[0] ? mapRouteRow(rows[0]) : null;
}

function mapRouteRow(row) {
  return {
    ...row,
    stops: normalizeJsonArray(row.stops).filter((stop) => stop.stationId !== null)
  };
}

async function getTripById(tripId) {
  const rows = await query(
    `
      SELECT
        trips.id,
        trips.route_id AS routeId,
        trips.train_id AS trainId,
        trips.trip_code AS tripCode,
        trips.departure_datetime AS departureAt,
        trips.arrival_datetime AS arrivalAt,
        trips.base_price AS basePrice,
        trips.status,
        trips.sale_start_at AS saleStartAt,
        trips.sale_end_at AS saleEndAt,
        routes.code AS routeCode,
        routes.name AS routeName,
        origin_station.name AS originStationName,
        destination_station.name AS destinationStationName,
        trains.code AS trainCode,
        trains.name AS trainName
      FROM trips
      INNER JOIN routes ON routes.id = trips.route_id
      INNER JOIN stations AS origin_station ON origin_station.id = routes.origin_station_id
      INNER JOIN stations AS destination_station ON destination_station.id = routes.destination_station_id
      INNER JOIN trains ON trains.id = trips.train_id
      WHERE trips.id = ?
      LIMIT 1
    `,
    [tripId]
  );

  return rows[0] ?? null;
}

function normalizeStationPayload(body, { partial }) {
  const value = {};

  if (body.code !== undefined) {
    const code = String(body.code).trim().toUpperCase();
    if (!code) {
      return { ok: false, message: "code is required" };
    }
    value.code = code;
  } else if (!partial) {
    return { ok: false, message: "code is required" };
  }

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return { ok: false, message: "name is required" };
    }
    value.name = name;
  } else if (!partial) {
    return { ok: false, message: "name is required" };
  }

  if (body.city !== undefined) {
    const city = String(body.city).trim();
    if (!city) {
      return { ok: false, message: "city is required" };
    }
    value.city = city;
  } else if (!partial) {
    return { ok: false, message: "city is required" };
  }

  if (body.address !== undefined) {
    const address = body.address === null ? null : String(body.address).trim();
    value.address = address || null;
  } else if (!partial) {
    value.address = null;
  }

  if (body.isActive !== undefined) {
    value.isActive = parseBooleanBody(body.isActive, "isActive");
    if (value.isActive === null) {
      return { ok: false, message: "isActive must be a boolean" };
    }
  } else if (!partial) {
    value.isActive = 1;
  }

  return { ok: true, value };
}

function normalizeRoutePayload(body, { partial }) {
  const value = {};

  if (body.code !== undefined) {
    const code = String(body.code).trim().toUpperCase();
    if (!code) {
      return { ok: false, message: "code is required" };
    }
    value.code = code;
  } else if (!partial) {
    return { ok: false, message: "code is required" };
  }

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return { ok: false, message: "name is required" };
    }
    value.name = name;
  } else if (!partial) {
    return { ok: false, message: "name is required" };
  }

  const rawOriginStationId = body.originStationId ?? body.fromStationId;
  if (rawOriginStationId !== undefined) {
    const originStationId = parsePositiveInt(rawOriginStationId);
    if (!originStationId) {
      return { ok: false, message: "originStationId must be a positive integer" };
    }
    value.originStationId = originStationId;
  } else if (!partial) {
    return { ok: false, message: "originStationId is required" };
  }

  const rawDestinationStationId = body.destinationStationId ?? body.toStationId;
  if (rawDestinationStationId !== undefined) {
    const destinationStationId = parsePositiveInt(rawDestinationStationId);
    if (!destinationStationId) {
      return { ok: false, message: "destinationStationId must be a positive integer" };
    }
    value.destinationStationId = destinationStationId;
  } else if (!partial) {
    return { ok: false, message: "destinationStationId is required" };
  }

  if (
    value.originStationId &&
    value.destinationStationId &&
    value.originStationId === value.destinationStationId
  ) {
    return { ok: false, message: "Origin and destination stations must be different" };
  }

  if (body.isActive !== undefined) {
    value.isActive = parseBooleanBody(body.isActive, "isActive");
    if (value.isActive === null) {
      return { ok: false, message: "isActive must be a boolean" };
    }
  } else if (!partial) {
    value.isActive = 1;
  }

  if (body.stops !== undefined) {
    const stops = normalizeRouteStops(body.stops);
    if (!stops.ok) {
      return stops;
    }
    value.stops = stops.value;
  } else if (
    value.originStationId &&
    value.destinationStationId &&
    !partial
  ) {
    value.stops = [
      {
        stationId: value.originStationId,
        stopOrder: 1,
        arrivalOffsetMinutes: null,
        departureOffsetMinutes: 0,
        stopDurationMinutes: 0,
        distanceFromOriginKm: 0
      },
      {
        stationId: value.destinationStationId,
        stopOrder: 2,
        arrivalOffsetMinutes: 60,
        departureOffsetMinutes: null,
        stopDurationMinutes: 0,
        distanceFromOriginKm: 100
      }
    ];
  } else if (!partial) {
    return { ok: false, message: "stops array is required" };
  }

  if (value.stops) {
    const routeShapeValidation = validateRouteShape(
      value.originStationId,
      value.destinationStationId,
      value.stops
    );
    if (!routeShapeValidation.ok) {
      return routeShapeValidation;
    }
  }

  return { ok: true, value };
}

function normalizeRouteStops(rawStops) {
  if (!Array.isArray(rawStops) || rawStops.length < 2) {
    return { ok: false, message: "stops must contain at least origin and destination" };
  }

  const normalized = [];
  const seenOrders = new Set();
  const seenStations = new Set();

  for (const [index, stop] of rawStops.entries()) {
    const stationId = parsePositiveInt(stop.stationId);
    const stopOrder = parsePositiveInt(stop.stopOrder);
    const stopDurationMinutes =
      stop.stopDurationMinutes === undefined ? 0 : Number(stop.stopDurationMinutes);
    const arrivalOffsetMinutes =
      stop.arrivalOffsetMinutes === null || stop.arrivalOffsetMinutes === undefined
        ? null
        : Number(stop.arrivalOffsetMinutes);
    const departureOffsetMinutes =
      stop.departureOffsetMinutes === null || stop.departureOffsetMinutes === undefined
        ? null
        : Number(stop.departureOffsetMinutes);
    const distanceFromOriginKm =
      stop.distanceFromOriginKm === null || stop.distanceFromOriginKm === undefined
        ? null
        : Number(stop.distanceFromOriginKm);

    if (!stationId || !stopOrder) {
      return {
        ok: false,
        message: `Each stop must include positive stationId and stopOrder values`
      };
    }

    if (seenOrders.has(stopOrder)) {
      return { ok: false, message: "stopOrder values must be unique" };
    }

    if (seenStations.has(stationId)) {
      return { ok: false, message: "A station may appear only once in route stops" };
    }

    if (!Number.isFinite(stopDurationMinutes) || stopDurationMinutes < 0) {
      return { ok: false, message: "stopDurationMinutes must be zero or greater" };
    }

    if (arrivalOffsetMinutes !== null && (!Number.isFinite(arrivalOffsetMinutes) || arrivalOffsetMinutes < 0)) {
      return { ok: false, message: "arrivalOffsetMinutes must be null or zero or greater" };
    }

    if (
      departureOffsetMinutes !== null &&
      (!Number.isFinite(departureOffsetMinutes) || departureOffsetMinutes < 0)
    ) {
      return { ok: false, message: "departureOffsetMinutes must be null or zero or greater" };
    }

    if (
      arrivalOffsetMinutes !== null &&
      departureOffsetMinutes !== null &&
      departureOffsetMinutes < arrivalOffsetMinutes
    ) {
      return {
        ok: false,
        message: "departureOffsetMinutes must be greater than or equal to arrivalOffsetMinutes"
      };
    }

    if (distanceFromOriginKm !== null && (!Number.isFinite(distanceFromOriginKm) || distanceFromOriginKm < 0)) {
      return { ok: false, message: "distanceFromOriginKm must be null or zero or greater" };
    }

    seenOrders.add(stopOrder);
    seenStations.add(stationId);
    normalized.push({
      stationId,
      stopOrder,
      arrivalOffsetMinutes,
      departureOffsetMinutes,
      stopDurationMinutes,
      distanceFromOriginKm
    });
  }

  normalized.sort((left, right) => left.stopOrder - right.stopOrder);
  return { ok: true, value: normalized };
}

function validateRouteShape(originStationId, destinationStationId, stops) {
  if (!originStationId || !destinationStationId) {
    return { ok: true };
  }

  if (stops[0]?.stationId !== originStationId) {
    return { ok: false, message: "First stop must match originStationId" };
  }

  if (stops[stops.length - 1]?.stationId !== destinationStationId) {
    return { ok: false, message: "Last stop must match destinationStationId" };
  }

  return { ok: true };
}

function normalizeTripPayload(body, { partial }) {
  const value = {};

  if (body.routeId !== undefined) {
    const routeId = parsePositiveInt(body.routeId);
    if (!routeId) {
      return { ok: false, message: "routeId must be a positive integer" };
    }
    value.routeId = routeId;
  } else if (!partial) {
    return { ok: false, message: "routeId is required" };
  }

  if (body.trainId !== undefined) {
    const trainId = parsePositiveInt(body.trainId);
    if (!trainId) {
      return { ok: false, message: "trainId must be a positive integer" };
    }
    value.trainId = trainId;
  } else if (!partial) {
    return { ok: false, message: "trainId is required" };
  }

  const rawTripCode = body.tripCode ?? body.code;
  if (rawTripCode !== undefined) {
    const tripCode = String(rawTripCode).trim().toUpperCase();
    if (!tripCode) {
      return { ok: false, message: "tripCode is required" };
    }
    value.tripCode = tripCode;
  } else if (!partial) {
    value.tripCode = `TRIP-${Date.now()}`;
  }

  if (body.departureAt !== undefined) {
    const departureAt = normalizeDateTime(body.departureAt);
    if (!departureAt) {
      return { ok: false, message: "departureAt must be a valid datetime string" };
    }
    value.departureAt = departureAt;
  } else if (!partial) {
    return { ok: false, message: "departureAt is required" };
  }

  if (body.arrivalAt !== undefined) {
    const arrivalAt = normalizeDateTime(body.arrivalAt);
    if (!arrivalAt) {
      return { ok: false, message: "arrivalAt must be a valid datetime string" };
    }
    value.arrivalAt = arrivalAt;
  } else if (!partial) {
    return { ok: false, message: "arrivalAt is required" };
  }

  if (body.basePrice !== undefined) {
    const basePrice = Number(body.basePrice);
    if (!Number.isFinite(basePrice) || basePrice < 0) {
      return { ok: false, message: "basePrice must be zero or greater" };
    }
    value.basePrice = basePrice;
  } else if (!partial) {
    return { ok: false, message: "basePrice is required" };
  }

  if (body.status !== undefined) {
    const status = String(body.status).trim();
    if (!["scheduled", "cancelled", "completed"].includes(status)) {
      return { ok: false, message: "status must be scheduled, cancelled, or completed" };
    }
    value.status = status;
  } else if (!partial) {
    value.status = "scheduled";
  }

  if (body.saleStartAt !== undefined) {
    if (body.saleStartAt === null || body.saleStartAt === "") {
      value.saleStartAt = null;
    } else {
      const saleStartAt = normalizeDateTime(body.saleStartAt);
      if (!saleStartAt) {
        return { ok: false, message: "saleStartAt must be null or a valid datetime string" };
      }
      value.saleStartAt = saleStartAt;
    }
  } else if (!partial) {
    value.saleStartAt = null;
  }

  if (body.saleEndAt !== undefined) {
    if (body.saleEndAt === null || body.saleEndAt === "") {
      value.saleEndAt = null;
    } else {
      const saleEndAt = normalizeDateTime(body.saleEndAt);
      if (!saleEndAt) {
        return { ok: false, message: "saleEndAt must be null or a valid datetime string" };
      }
      value.saleEndAt = saleEndAt;
    }
  } else if (!partial) {
    value.saleEndAt = null;
  }

  const dateValidation = validateTripDateRules(value);
  if (!dateValidation.ok) {
    return dateValidation;
  }

  return { ok: true, value };
}

function validateTripDateRules(trip) {
  if (trip.departureAt && trip.arrivalAt) {
    const departureAt = new Date(trip.departureAt);
    const arrivalAt = new Date(trip.arrivalAt);
    if (!(arrivalAt > departureAt)) {
      return { ok: false, message: "arrivalAt must be later than departureAt" };
    }
  }

  if (trip.saleStartAt && trip.saleEndAt) {
    const saleStartAt = new Date(trip.saleStartAt);
    const saleEndAt = new Date(trip.saleEndAt);
    if (saleEndAt < saleStartAt) {
      return { ok: false, message: "saleEndAt must be later than or equal to saleStartAt" };
    }
  }

  return { ok: true };
}

async function validateRouteDependencies({ routeId, code, stationIds }) {
  const codeRows = await query(
    `
      SELECT id
      FROM routes
      WHERE code = ?
        AND (? IS NULL OR id <> ?)
      LIMIT 1
    `,
    [code, routeId, routeId]
  );

  if (codeRows.length > 0) {
    return { ok: false, status: 409, message: "Route with the same code already exists" };
  }

  const stationRows = await query(
    `
      SELECT id
      FROM stations
      WHERE id IN (${stationIds.map(() => "?").join(", ")})
    `,
    stationIds
  );

  if (stationRows.length !== stationIds.length) {
    return { ok: false, status: 404, message: "One or more stations were not found" };
  }

  return { ok: true };
}

async function validateTripDependencies({ tripId, routeId, trainId, tripCode }) {
  const [routeRows, trainRows, duplicateCodeRows] = await Promise.all([
    query("SELECT id FROM routes WHERE id = ? LIMIT 1", [routeId]),
    query("SELECT id FROM trains WHERE id = ? LIMIT 1", [trainId]),
    query(
      `
        SELECT id
        FROM trips
        WHERE trip_code = ?
          AND (? IS NULL OR id <> ?)
        LIMIT 1
      `,
      [tripCode, tripId, tripId]
    )
  ]);

  if (routeRows.length === 0) {
    return { ok: false, status: 404, message: "Route not found" };
  }

  if (trainRows.length === 0) {
    return { ok: false, status: 404, message: "Train not found" };
  }

  if (duplicateCodeRows.length > 0) {
    return { ok: false, status: 409, message: "Trip with the same tripCode already exists" };
  }

  return { ok: true };
}

async function replaceRouteStops(connection, routeId, stops) {
  await connection.execute("DELETE FROM route_stations WHERE route_id = ?", [routeId]);

  for (const stop of stops) {
    await connection.execute(
      `
        INSERT INTO route_stations (
          route_id,
          station_id,
          stop_order,
          arrival_offset_minutes,
          departure_offset_minutes,
          stop_duration_minutes,
          distance_from_origin_km
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        routeId,
        stop.stationId,
        stop.stopOrder,
        stop.arrivalOffsetMinutes,
        stop.departureOffsetMinutes,
        stop.stopDurationMinutes,
        stop.distanceFromOriginKm
      ]
    );
  }
}

function parsePositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseBooleanBody(value) {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (value === 1 || value === "1") {
    return 1;
  }

  if (value === 0 || value === "0") {
    return 0;
  }

  return null;
}

function parseBooleanFlag(value) {
  return value === "true" || value === "1" || value === true;
}

function normalizeDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 19).replace("T", " ");
}

function normalizeJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }

  return [];
}

function uniqueIds(values) {
  return [...new Set(values.filter(Boolean))];
}

export default router;
