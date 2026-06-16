import { Router } from "express";
import { query, withTransaction } from "../db/connection.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

router.use(requireRole("admin"));

router.get("/trains", async (req, res, next) => {
  try {
    const search = String(req.query.search ?? "").trim();
    const activeOnly = parseOptionalBooleanQuery(req.query.activeOnly);
    if (activeOnly.error) {
      return res.status(422).json({ message: activeOnly.error });
    }
    const searchPattern = `%${search}%`;

    const items = await query(
      `
        SELECT
          trains.id,
          trains.code,
          trains.name,
          trains.category,
          trains.is_active AS isActive,
          COUNT(DISTINCT carriages.id) AS carriageCount,
          COALESCE(SUM(carriages.seat_capacity), 0) AS seatCapacity
        FROM trains
        LEFT JOIN carriages ON carriages.train_id = trains.id
        WHERE (
          ? = ''
          OR trains.code LIKE ?
          OR trains.name LIKE ?
          OR trains.category LIKE ?
        )
        AND (? IS NULL OR trains.is_active = ?)
        GROUP BY trains.id, trains.code, trains.name, trains.category, trains.is_active
        ORDER BY trains.code ASC, trains.id ASC
      `,
      [search, searchPattern, searchPattern, searchPattern, activeOnly.value, activeOnly.value]
    );

    res.json({ items: items.map(mapTrainRow) });
  } catch (error) {
    next(error);
  }
});

router.post("/trains", async (req, res, next) => {
  try {
    const payload = parseTrainPayload(req.body);
    if (payload.error) {
      return res.status(422).json({ message: payload.error });
    }

    const result = await withTransaction(async (connection) => {
      try {
        const [insertResult] = await connection.execute(
          `
            INSERT INTO trains (
              code,
              name,
              category,
              is_active
            )
            VALUES (?, ?, ?, ?)
          `,
          [payload.code, payload.name, payload.category, payload.isActive]
        );

        const [rows] = await connection.execute(
          `
            SELECT
              id,
              code,
              name,
              category,
              is_active AS isActive
            FROM trains
            WHERE id = ?
            LIMIT 1
          `,
          [insertResult.insertId]
        );

        return { type: "success", train: mapTrainRow(rows[0]) };
      } catch (error) {
        return mapDatabaseError(error, {
          duplicate: "Train code already exists"
        });
      }
    });

    if (result.type !== "success") {
      return res.status(result.status).json({ message: result.message });
    }

    return res.status(201).json({ train: result.train });
  } catch (error) {
    return next(error);
  }
});

router.patch("/trains/:trainId", async (req, res, next) => {
  try {
    const trainId = parsePositiveInteger(req.params.trainId);
    if (!trainId) {
      return res.status(422).json({ message: "trainId must be a positive integer" });
    }

    const payload = parseTrainPayload(req.body, { partial: true });
    if (payload.error) {
      return res.status(422).json({ message: payload.error });
    }

    if (payload.fields.length === 0) {
      return res.status(422).json({ message: "At least one train field must be provided" });
    }

    const result = await withTransaction(async (connection) => {
      const [existingRows] = await connection.execute(
        `
          SELECT id
          FROM trains
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [trainId]
      );

      if (existingRows.length === 0) {
        return { type: "not_found", message: "Train not found", status: 404 };
      }

      try {
        await connection.execute(
          `
            UPDATE trains
            SET ${payload.fields.join(", ")},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [...payload.values, trainId]
        );

        const [rows] = await connection.execute(
          `
            SELECT
              id,
              code,
              name,
              category,
              is_active AS isActive
            FROM trains
            WHERE id = ?
            LIMIT 1
          `,
          [trainId]
        );

        return { type: "success", train: mapTrainRow(rows[0]) };
      } catch (error) {
        return mapDatabaseError(error, {
          duplicate: "Train code already exists"
        });
      }
    });

    if (result.type !== "success") {
      return res.status(result.status).json({ message: result.message });
    }

    return res.json({ train: result.train });
  } catch (error) {
    return next(error);
  }
});

router.delete("/trains/:trainId", async (req, res, next) => {
  try {
    const trainId = parsePositiveInteger(req.params.trainId);
    if (!trainId) {
      return res.status(422).json({ message: "trainId must be a positive integer" });
    }

    const result = await query("UPDATE trains SET is_active = 0 WHERE id = ?", [trainId]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: "Train not found" });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.get("/carriages", async (req, res, next) => {
  try {
    const trainId = req.query.trainId === undefined ? null : parsePositiveInteger(req.query.trainId);
    if (req.query.trainId !== undefined && !trainId) {
      return res.status(422).json({ message: "trainId must be a positive integer" });
    }

    const activeOnly = parseOptionalBooleanQuery(req.query.activeOnly);
    if (activeOnly.error) {
      return res.status(422).json({ message: activeOnly.error });
    }

    const items = await query(
      `
        SELECT
          carriages.id,
          carriages.train_id AS trainId,
          trains.code AS trainCode,
          trains.name AS trainName,
          carriages.carriage_number AS carriageNumber,
          carriages.carriage_type AS carriageType,
          carriages.class_code AS classCode,
          carriages.seat_capacity AS seatCapacity,
          carriages.is_active AS isActive,
          COUNT(seats.id) AS seatsCount
        FROM carriages
        INNER JOIN trains ON trains.id = carriages.train_id
        LEFT JOIN seats ON seats.carriage_id = carriages.id
        WHERE (? IS NULL OR carriages.train_id = ?)
          AND (? IS NULL OR carriages.is_active = ?)
        GROUP BY
          carriages.id,
          carriages.train_id,
          trains.code,
          trains.name,
          carriages.carriage_number,
          carriages.carriage_type,
          carriages.class_code,
          carriages.seat_capacity,
          carriages.is_active
        ORDER BY trains.code ASC, carriages.carriage_number ASC, carriages.id ASC
      `,
      [trainId, trainId, activeOnly.value, activeOnly.value]
    );

    res.json({ items: items.map(mapCarriageRow) });
  } catch (error) {
    next(error);
  }
});

router.post("/carriages", async (req, res, next) => {
  try {
    const payload = parseCarriagePayload(req.body);
    if (payload.error) {
      return res.status(422).json({ message: payload.error });
    }

    const result = await withTransaction(async (connection) => {
      const [trainRows] = await connection.execute(
        `
          SELECT id, code, name
          FROM trains
          WHERE id = ?
          LIMIT 1
        `,
        [payload.trainId]
      );

      const train = trainRows[0];
      if (!train) {
        return { type: "not_found", status: 404, message: "Train not found" };
      }

      try {
        const [insertResult] = await connection.execute(
          `
            INSERT INTO carriages (
              train_id,
              carriage_number,
              carriage_type,
              class_code,
              seat_capacity,
              is_active
            )
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            payload.trainId,
            payload.carriageNumber,
            payload.carriageType,
            payload.classCode,
            payload.seatCapacity,
            payload.isActive
          ]
        );

        const [rows] = await connection.execute(
          `
            SELECT
              carriages.id,
              carriages.train_id AS trainId,
              trains.code AS trainCode,
              trains.name AS trainName,
              carriages.carriage_number AS carriageNumber,
              carriages.carriage_type AS carriageType,
              carriages.class_code AS classCode,
              carriages.seat_capacity AS seatCapacity,
              carriages.is_active AS isActive
            FROM carriages
            INNER JOIN trains ON trains.id = carriages.train_id
            WHERE carriages.id = ?
            LIMIT 1
          `,
          [insertResult.insertId]
        );

        return { type: "success", carriage: mapCarriageRow(rows[0]) };
      } catch (error) {
        return mapDatabaseError(error, {
          duplicate: "Carriage number already exists for this train"
        });
      }
    });

    if (result.type !== "success") {
      return res.status(result.status).json({ message: result.message });
    }

    return res.status(201).json({ carriage: result.carriage });
  } catch (error) {
    return next(error);
  }
});

router.patch("/carriages/:carriageId", async (req, res, next) => {
  try {
    const carriageId = parsePositiveInteger(req.params.carriageId);
    if (!carriageId) {
      return res.status(422).json({ message: "carriageId must be a positive integer" });
    }

    const payload = parseCarriagePayload(req.body, { partial: true });
    if (payload.error) {
      return res.status(422).json({ message: payload.error });
    }

    if (payload.fields.length === 0) {
      return res.status(422).json({ message: "At least one carriage field must be provided" });
    }

    const result = await withTransaction(async (connection) => {
      const [existingRows] = await connection.execute(
        `
          SELECT id, train_id
          FROM carriages
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [carriageId]
      );

      const existing = existingRows[0];
      if (!existing) {
        return { type: "not_found", status: 404, message: "Carriage not found" };
      }

      if (payload.trainId !== undefined) {
        const [trainRows] = await connection.execute(
          `
            SELECT id
            FROM trains
            WHERE id = ?
            LIMIT 1
          `,
          [payload.trainId]
        );

        if (trainRows.length === 0) {
          return { type: "not_found", status: 404, message: "Train not found" };
        }
      }

      try {
        await connection.execute(
          `
            UPDATE carriages
            SET ${payload.fields.join(", ")},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [...payload.values, carriageId]
        );

        const [rows] = await connection.execute(
          `
            SELECT
              carriages.id,
              carriages.train_id AS trainId,
              trains.code AS trainCode,
              trains.name AS trainName,
              carriages.carriage_number AS carriageNumber,
              carriages.carriage_type AS carriageType,
              carriages.class_code AS classCode,
              carriages.seat_capacity AS seatCapacity,
              carriages.is_active AS isActive
            FROM carriages
            INNER JOIN trains ON trains.id = carriages.train_id
            WHERE carriages.id = ?
            LIMIT 1
          `,
          [carriageId]
        );

        return { type: "success", carriage: mapCarriageRow(rows[0]) };
      } catch (error) {
        return mapDatabaseError(error, {
          duplicate: "Carriage number already exists for this train"
        });
      }
    });

    if (result.type !== "success") {
      return res.status(result.status).json({ message: result.message });
    }

    return res.json({ carriage: result.carriage });
  } catch (error) {
    return next(error);
  }
});

router.delete("/carriages/:carriageId", async (req, res, next) => {
  try {
    const carriageId = parsePositiveInteger(req.params.carriageId);
    if (!carriageId) {
      return res.status(422).json({ message: "carriageId must be a positive integer" });
    }

    const result = await query("UPDATE carriages SET is_active = 0 WHERE id = ?", [carriageId]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: "Carriage not found" });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.get("/seats", async (req, res, next) => {
  try {
    const carriageId = req.query.carriageId === undefined ? null : parsePositiveInteger(req.query.carriageId);
    if (req.query.carriageId !== undefined && !carriageId) {
      return res.status(422).json({ message: "carriageId must be a positive integer" });
    }

    const activeOnly = parseOptionalBooleanQuery(req.query.activeOnly);
    if (activeOnly.error) {
      return res.status(422).json({ message: activeOnly.error });
    }

    const items = await query(
      `
        SELECT
          seats.id,
          seats.carriage_id AS carriageId,
          seats.seat_number AS seatNumber,
          seats.seat_type AS seatType,
          seats.class_code AS classCode,
          seats.is_active AS isActive,
          carriages.train_id AS trainId,
          carriages.carriage_number AS carriageNumber,
          trains.code AS trainCode
        FROM seats
        INNER JOIN carriages ON carriages.id = seats.carriage_id
        INNER JOIN trains ON trains.id = carriages.train_id
        WHERE (? IS NULL OR seats.carriage_id = ?)
          AND (? IS NULL OR seats.is_active = ?)
        ORDER BY trains.code ASC, carriages.carriage_number ASC, seats.seat_number ASC, seats.id ASC
      `,
      [carriageId, carriageId, activeOnly.value, activeOnly.value]
    );

    res.json({ items: items.map(mapSeatRow) });
  } catch (error) {
    next(error);
  }
});

router.post("/seats", async (req, res, next) => {
  try {
    const payload = parseSeatPayload(req.body);
    if (payload.error) {
      return res.status(422).json({ message: payload.error });
    }

    const result = await withTransaction(async (connection) => {
      const [carriageRows] = await connection.execute(
        `
          SELECT id
          FROM carriages
          WHERE id = ?
          LIMIT 1
        `,
        [payload.carriageId]
      );

      if (carriageRows.length === 0) {
        return { type: "not_found", status: 404, message: "Carriage not found" };
      }

      try {
        const [insertResult] = await connection.execute(
          `
            INSERT INTO seats (
              carriage_id,
              seat_number,
              seat_type,
              class_code,
              is_active
            )
            VALUES (?, ?, ?, ?, ?)
          `,
          [
            payload.carriageId,
            payload.seatNumber,
            payload.seatType,
            payload.classCode,
            payload.isActive
          ]
        );

        const [rows] = await connection.execute(
          `
            SELECT
              seats.id,
              seats.carriage_id AS carriageId,
              seats.seat_number AS seatNumber,
              seats.seat_type AS seatType,
              seats.class_code AS classCode,
              seats.is_active AS isActive,
              carriages.train_id AS trainId,
              carriages.carriage_number AS carriageNumber,
              trains.code AS trainCode
            FROM seats
            INNER JOIN carriages ON carriages.id = seats.carriage_id
            INNER JOIN trains ON trains.id = carriages.train_id
            WHERE seats.id = ?
            LIMIT 1
          `,
          [insertResult.insertId]
        );

        return { type: "success", seat: mapSeatRow(rows[0]) };
      } catch (error) {
        return mapDatabaseError(error, {
          duplicate: "Seat number already exists for this carriage"
        });
      }
    });

    if (result.type !== "success") {
      return res.status(result.status).json({ message: result.message });
    }

    return res.status(201).json({ seat: result.seat });
  } catch (error) {
    return next(error);
  }
});

router.patch("/seats/:seatId", async (req, res, next) => {
  try {
    const seatId = parsePositiveInteger(req.params.seatId);
    if (!seatId) {
      return res.status(422).json({ message: "seatId must be a positive integer" });
    }

    const payload = parseSeatPayload(req.body, { partial: true });
    if (payload.error) {
      return res.status(422).json({ message: payload.error });
    }

    if (payload.fields.length === 0) {
      return res.status(422).json({ message: "At least one seat field must be provided" });
    }

    const result = await withTransaction(async (connection) => {
      const [existingRows] = await connection.execute(
        `
          SELECT id, carriage_id
          FROM seats
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [seatId]
      );

      if (existingRows.length === 0) {
        return { type: "not_found", status: 404, message: "Seat not found" };
      }

      if (payload.carriageId !== undefined) {
        const [carriageRows] = await connection.execute(
          `
            SELECT id
            FROM carriages
            WHERE id = ?
            LIMIT 1
          `,
          [payload.carriageId]
        );

        if (carriageRows.length === 0) {
          return { type: "not_found", status: 404, message: "Carriage not found" };
        }
      }

      try {
        await connection.execute(
          `
            UPDATE seats
            SET ${payload.fields.join(", ")},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [...payload.values, seatId]
        );

        const [rows] = await connection.execute(
          `
            SELECT
              seats.id,
              seats.carriage_id AS carriageId,
              seats.seat_number AS seatNumber,
              seats.seat_type AS seatType,
              seats.class_code AS classCode,
              seats.is_active AS isActive,
              carriages.train_id AS trainId,
              carriages.carriage_number AS carriageNumber,
              trains.code AS trainCode
            FROM seats
            INNER JOIN carriages ON carriages.id = seats.carriage_id
            INNER JOIN trains ON trains.id = carriages.train_id
            WHERE seats.id = ?
            LIMIT 1
          `,
          [seatId]
        );

        return { type: "success", seat: mapSeatRow(rows[0]) };
      } catch (error) {
        return mapDatabaseError(error, {
          duplicate: "Seat number already exists for this carriage"
        });
      }
    });

    if (result.type !== "success") {
      return res.status(result.status).json({ message: result.message });
    }

    return res.json({ seat: result.seat });
  } catch (error) {
    return next(error);
  }
});

router.delete("/seats/:seatId", async (req, res, next) => {
  try {
    const seatId = parsePositiveInteger(req.params.seatId);
    if (!seatId) {
      return res.status(422).json({ message: "seatId must be a positive integer" });
    }

    const result = await query("UPDATE seats SET is_active = 0 WHERE id = ?", [seatId]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: "Seat not found" });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

function parseTrainPayload(body, options = {}) {
  const partial = options.partial === true;
  const payload = body ?? {};
  const fields = [];
  const values = [];

  const code = normalizeOptionalString(payload.code);
  if (!partial || payload.code !== undefined) {
    if (!code) {
      return { error: "code is required" };
    }
    fields.push("code = ?");
    values.push(code);
  }

  const name = normalizeOptionalString(payload.name);
  if (!partial || payload.name !== undefined) {
    if (!name) {
      return { error: "name is required" };
    }
    fields.push("name = ?");
    values.push(name);
  }

  const category = normalizeOptionalString(payload.category ?? "standard");
  if (!partial || payload.category !== undefined) {
    if (!category) {
      return { error: "category is required" };
    }
    fields.push("category = ?");
    values.push(category);
  }

  const isActive = normalizeOptionalBoolean(payload.isActive);
  if (!partial || payload.isActive !== undefined) {
    if (isActive === null) {
      return { error: "isActive must be boolean" };
    }
    fields.push("is_active = ?");
    values.push(isActive);
  }

  return {
    code,
    name,
    category,
    isActive,
    fields,
    values
  };
}

function parseCarriagePayload(body, options = {}) {
  const partial = options.partial === true;
  const payload = body ?? {};
  const fields = [];
  const values = [];

  const trainId = payload.trainId === undefined ? undefined : parsePositiveInteger(payload.trainId);
  if (!partial || payload.trainId !== undefined) {
    if (!trainId) {
      return { error: "trainId must be a positive integer" };
    }
    fields.push("train_id = ?");
    values.push(trainId);
  }

  const carriageNumber = normalizeOptionalString(payload.carriageNumber ?? payload.number);
  if (!partial || payload.carriageNumber !== undefined) {
    if (!carriageNumber) {
      return { error: "carriageNumber is required" };
    }
    fields.push("carriage_number = ?");
    values.push(carriageNumber);
  }

  const carriageType = normalizeOptionalString(payload.carriageType ?? payload.type);
  if (!partial || payload.carriageType !== undefined) {
    if (!carriageType) {
      return { error: "carriageType is required" };
    }
    fields.push("carriage_type = ?");
    values.push(carriageType);
  }

  const classCode = normalizeOptionalString(payload.classCode ?? "standard");
  if (!partial || payload.classCode !== undefined) {
    if (!classCode) {
      return { error: "classCode is required" };
    }
    fields.push("class_code = ?");
    values.push(classCode);
  }

  const rawSeatCapacity = payload.seatCapacity ?? 50;
  const seatCapacity = rawSeatCapacity === undefined ? undefined : Number(rawSeatCapacity);
  if (!partial || payload.seatCapacity !== undefined) {
    if (!Number.isInteger(seatCapacity) || seatCapacity <= 0) {
      return { error: "seatCapacity must be a positive integer" };
    }
    fields.push("seat_capacity = ?");
    values.push(seatCapacity);
  }

  const isActive = normalizeOptionalBoolean(payload.isActive);
  if (!partial || payload.isActive !== undefined) {
    if (isActive === null) {
      return { error: "isActive must be boolean" };
    }
    fields.push("is_active = ?");
    values.push(isActive);
  }

  return {
    trainId,
    carriageNumber,
    carriageType,
    classCode,
    seatCapacity,
    isActive,
    fields,
    values
  };
}

function parseSeatPayload(body, options = {}) {
  const partial = options.partial === true;
  const payload = body ?? {};
  const fields = [];
  const values = [];

  const carriageId = payload.carriageId === undefined ? undefined : parsePositiveInteger(payload.carriageId);
  if (!partial || payload.carriageId !== undefined) {
    if (!carriageId) {
      return { error: "carriageId must be a positive integer" };
    }
    fields.push("carriage_id = ?");
    values.push(carriageId);
  }

  const seatNumber = normalizeOptionalString(payload.seatNumber ?? payload.number);
  if (!partial || payload.seatNumber !== undefined) {
    if (!seatNumber) {
      return { error: "seatNumber is required" };
    }
    fields.push("seat_number = ?");
    values.push(seatNumber);
  }

  const seatType = normalizeOptionalString(payload.seatType ?? "standard");
  if (!partial || payload.seatType !== undefined) {
    if (!seatType) {
      return { error: "seatType is required" };
    }
    fields.push("seat_type = ?");
    values.push(seatType);
  }

  const classCode = normalizeOptionalString(payload.classCode ?? payload.classType ?? "standard");
  if (!partial || payload.classCode !== undefined) {
    if (!classCode) {
      return { error: "classCode is required" };
    }
    fields.push("class_code = ?");
    values.push(classCode);
  }

  const isActive = normalizeOptionalBoolean(payload.isActive);
  if (!partial || payload.isActive !== undefined) {
    if (isActive === null) {
      return { error: "isActive must be boolean" };
    }
    fields.push("is_active = ?");
    values.push(isActive);
  }

  return {
    carriageId,
    seatNumber,
    seatType,
    classCode,
    isActive,
    fields,
    values
  };
}

function parsePositiveInteger(value) {
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    return null;
  }

  return numericValue;
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalBoolean(value) {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  return value === undefined ? undefined : null;
}

function parseOptionalBooleanQuery(value) {
  if (value === undefined) {
    return { value: null };
  }

  if (value === "true" || value === "1") {
    return { value: 1 };
  }

  if (value === "false" || value === "0") {
    return { value: 0 };
  }

  return { error: "activeOnly must be true, false, 1, or 0" };
}

function mapDatabaseError(error, messages = {}) {
  if (error?.code === "ER_DUP_ENTRY") {
    return {
      type: "error",
      status: 409,
      message: messages.duplicate ?? "Duplicate value"
    };
  }

  if (error?.code === "ER_NO_REFERENCED_ROW_2") {
    return {
      type: "error",
      status: 404,
      message: messages.notFound ?? "Related entity not found"
    };
  }

  throw error;
}

function mapTrainRow(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    isActive: Boolean(row.isActive),
    carriageCount: row.carriageCount === undefined ? undefined : Number(row.carriageCount),
    seatCapacity: row.seatCapacity === undefined ? undefined : Number(row.seatCapacity)
  };
}

function mapCarriageRow(row) {
  return {
    id: row.id,
    trainId: row.trainId,
    trainCode: row.trainCode,
    trainName: row.trainName,
    carriageNumber: row.carriageNumber,
    carriageType: row.carriageType,
    classCode: row.classCode,
    seatCapacity: Number(row.seatCapacity),
    isActive: Boolean(row.isActive),
    seatsCount: row.seatsCount === undefined ? undefined : Number(row.seatsCount)
  };
}

function mapSeatRow(row) {
  return {
    id: row.id,
    carriageId: row.carriageId,
    carriageNumber: row.carriageNumber,
    trainId: row.trainId,
    trainCode: row.trainCode,
    seatNumber: row.seatNumber,
    seatType: row.seatType,
    classCode: row.classCode,
    isActive: Boolean(row.isActive)
  };
}

export default router;
