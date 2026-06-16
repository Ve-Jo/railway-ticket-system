import { Router } from "express";
import bcrypt from "bcryptjs";
import { requireRole } from "../middleware/requireRole.js";
import { query } from "../db/connection.js";
import { getOperationLogs, writeOperationLog } from "../services/operationLogs.js";
import adminCatalogRoutes from "./adminCatalog.routes.js";
import adminRollingStockRoutes from "./admin-rolling-stock.routes.js";

const router = Router();

router.get("/overview", requireRole("admin"), async (req, res, next) => {
  try {
    const [users, stations, routes, trains, trips, bookings, tickets, refunds] = await Promise.all([
      query("SELECT COUNT(*) AS count FROM users"),
      query("SELECT COUNT(*) AS count FROM stations"),
      query("SELECT COUNT(*) AS count FROM routes"),
      query("SELECT COUNT(*) AS count FROM trains"),
      query("SELECT COUNT(*) AS count FROM trips"),
      query("SELECT COUNT(*) AS count FROM bookings"),
      query("SELECT COUNT(*) AS count FROM tickets"),
      query("SELECT COUNT(*) AS count FROM refunds")
    ]);

    res.json({
      totals: {
        users: users[0]?.count ?? 0,
        stations: stations[0]?.count ?? 0,
        routes: routes[0]?.count ?? 0,
        trains: trains[0]?.count ?? 0,
        trips: trips[0]?.count ?? 0,
        bookings: bookings[0]?.count ?? 0,
        tickets: tickets[0]?.count ?? 0,
        refunds: refunds[0]?.count ?? 0
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/users", requireRole("cashier", "admin"), async (req, res, next) => {
  try {
    const search = String(req.query.search ?? "").trim();
    const role = String(req.query.role ?? "").trim();
    const pattern = `%${search}%`;

    const items = await query(
      `
        SELECT
          users.id,
          users.username AS login,
          users.email,
          users.full_name AS fullName,
          roles.code AS role,
          users.is_active AS isActive
        FROM users
        INNER JOIN roles ON roles.id = users.role_id
        WHERE (? = '' OR roles.code = ?)
          AND (
            ? = ''
            OR users.username LIKE ?
            OR users.email LIKE ?
            OR users.full_name LIKE ?
          )
        ORDER BY users.id DESC
        LIMIT 50
      `,
      [role, role, search, pattern, pattern, pattern]
    );

    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.get("/bookings", requireRole("cashier", "admin"), async (req, res, next) => {
  try {
    const status = String(req.query.status ?? "").trim();
    const tripId = req.query.tripId ? Number(req.query.tripId) : null;
    const userId = req.query.userId ? Number(req.query.userId) : null;

    const items = await query(
      `
        SELECT
          bookings.id,
          bookings.status,
          bookings.booking_number,
          bookings.user_id AS userId,
          users.username AS passengerLogin,
          users.full_name AS passengerName,
          bookings.trip_id AS tripId,
          trips.trip_code AS routeCode,
          trains.name AS trainName,
          origin_station.name AS departureStation,
          destination_station.name AS arrivalStation,
          trips.departure_datetime AS departureAt,
          trips.arrival_datetime AS arrivalAt,
          carriages.carriage_number AS carriageNumber,
          seats.seat_number AS seatNumber,
          bookings.total_price AS price,
          bookings.reserved_until AS reservedUntil
        FROM bookings
        INNER JOIN users ON users.id = bookings.user_id
        INNER JOIN trips ON trips.id = bookings.trip_id
        INNER JOIN trains ON trains.id = trips.train_id
        INNER JOIN routes ON routes.id = trips.route_id
        INNER JOIN stations AS origin_station ON origin_station.id = routes.origin_station_id
        INNER JOIN stations AS destination_station ON destination_station.id = routes.destination_station_id
        INNER JOIN carriages ON carriages.id = bookings.carriage_id
        INNER JOIN seats ON seats.id = bookings.seat_id
        WHERE (? = '' OR bookings.status = ?)
          AND (? IS NULL OR bookings.trip_id = ?)
          AND (? IS NULL OR bookings.user_id = ?)
        ORDER BY bookings.id DESC
        LIMIT 100
      `,
      [status, status, tripId, tripId, userId, userId]
    );

    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.get("/tickets", requireRole("cashier", "admin"), async (req, res, next) => {
  try {
    const status = String(req.query.status ?? "").trim();
    const tripId = req.query.tripId ? Number(req.query.tripId) : null;
    const userId = req.query.userId ? Number(req.query.userId) : null;

    const items = await query(
      `
        SELECT
          tickets.id,
          tickets.ticket_number AS ticketNumber,
          tickets.ticket_status AS status,
          bookings.id AS bookingId,
          bookings.user_id AS userId,
          users.username AS passengerLogin,
          users.full_name AS passengerName,
          bookings.trip_id AS tripId,
          trips.trip_code AS routeCode,
          trains.name AS trainName,
          origin_station.name AS departureStation,
          destination_station.name AS arrivalStation,
          trips.departure_datetime AS departureAt,
          trips.arrival_datetime AS arrivalAt,
          carriages.carriage_number AS carriageNumber,
          seats.seat_number AS seatNumber,
          bookings.total_price AS price
        FROM tickets
        INNER JOIN bookings ON bookings.id = tickets.booking_id
        INNER JOIN users ON users.id = bookings.user_id
        INNER JOIN trips ON trips.id = bookings.trip_id
        INNER JOIN trains ON trains.id = trips.train_id
        INNER JOIN routes ON routes.id = trips.route_id
        INNER JOIN stations AS origin_station ON origin_station.id = routes.origin_station_id
        INNER JOIN stations AS destination_station ON destination_station.id = routes.destination_station_id
        INNER JOIN carriages ON carriages.id = bookings.carriage_id
        INNER JOIN seats ON seats.id = bookings.seat_id
        WHERE (? = '' OR tickets.ticket_status = ?)
          AND (? IS NULL OR bookings.trip_id = ?)
          AND (? IS NULL OR bookings.user_id = ?)
        ORDER BY tickets.id DESC
        LIMIT 100
      `,
      [status, status, tripId, tripId, userId, userId]
    );

    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.get("/refunds", requireRole("cashier", "admin"), async (req, res, next) => {
  try {
    const status = String(req.query.status ?? "").trim();
    const tripId = req.query.tripId ? Number(req.query.tripId) : null;
    const userId = req.query.userId ? Number(req.query.userId) : null;

    const items = await query(
      `
        SELECT
          refunds.id,
          refunds.ticket_id AS ticketId,
          refunds.booking_id AS bookingId,
          refunds.status,
          refunds.amount,
          refunds.reason,
          refunds.refunded_at AS refundedAt,
          bookings.user_id AS userId,
          users.username AS passengerLogin,
          trips.trip_code AS routeCode
        FROM refunds
        INNER JOIN bookings ON bookings.id = refunds.booking_id
        INNER JOIN users ON users.id = bookings.user_id
        INNER JOIN trips ON trips.id = bookings.trip_id
        WHERE (? = '' OR refunds.status = ?)
          AND (? IS NULL OR bookings.trip_id = ?)
          AND (? IS NULL OR bookings.user_id = ?)
        ORDER BY refunds.id DESC
        LIMIT 100
      `,
      [status, status, tripId, tripId, userId, userId]
    );

    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.use(requireRole("admin"));

router.get("/roles", async (req, res, next) => {
  try {
    const items = await query("SELECT code, name FROM roles ORDER BY id");
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.post("/users", async (req, res, next) => {
  try {
    const { username, email, fullName, phone, password, role } = req.body ?? {};

    if (!username || !email || !fullName || !password || !role) {
      return res.status(400).json({ message: "username, email, fullName, password and role are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    const roleRows = await query("SELECT id FROM roles WHERE code = ?", [role]);
    if (!roleRows[0]) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const existing = await query(
      "SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1",
      [username, email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: "User with this username or email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (role_id, username, email, phone, full_name, password_hash, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [roleRows[0].id, username, email, phone || null, fullName, passwordHash]
    );

    await writeOperationLog({
      actorUserId: req.session.user.id,
      entityType: "user",
      entityId: result.insertId,
      action: "admin.user.create",
      resultStatus: "success",
      ipAddress: req.ip,
      details: { username, role }
    });

    return res.status(201).json({
      id: result.insertId,
      username,
      email,
      fullName,
      role,
      isActive: true
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/users/:id/role", async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const { role } = req.body ?? {};
    const currentAdminId = req.session.user.id;

    if (!role) {
      return res.status(400).json({ message: "role is required" });
    }

    if (userId === currentAdminId) {
      return res.status(403).json({ message: "You cannot change your own role" });
    }

    const roleRows = await query("SELECT id FROM roles WHERE code = ?", [role]);
    if (!roleRows[0]) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const result = await query(
      "UPDATE users SET role_id = ? WHERE id = ?",
      [roleRows[0].id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    await writeOperationLog({
      actorUserId: currentAdminId,
      entityType: "user",
      entityId: userId,
      action: "admin.user.updateRole",
      resultStatus: "success",
      ipAddress: req.ip,
      details: { role }
    });

    return res.json({ id: userId, role });
  } catch (error) {
    return next(error);
  }
});

router.patch("/users/:id/status", async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const { isActive } = req.body ?? {};
    const currentAdminId = req.session.user.id;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "isActive boolean is required" });
    }

    if (userId === currentAdminId && !isActive) {
      return res.status(403).json({ message: "You cannot deactivate yourself" });
    }

    const result = await query(
      "UPDATE users SET is_active = ? WHERE id = ?",
      [isActive ? 1 : 0, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    await writeOperationLog({
      actorUserId: currentAdminId,
      entityType: "user",
      entityId: userId,
      action: "admin.user.updateStatus",
      resultStatus: "success",
      ipAddress: req.ip,
      details: { isActive }
    });

    return res.json({ id: userId, isActive });
  } catch (error) {
    return next(error);
  }
});

router.get("/operation-logs", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));

    const { items, total } = await getOperationLogs({
      actorUserId: req.query.actorUserId ? Number(req.query.actorUserId) : null,
      actorLoginSearch: req.query.actorLoginSearch || null,
      entityType: req.query.entityType || null,
      entityId: req.query.entityId ? Number(req.query.entityId) : null,
      action: req.query.action || null,
      resultStatus: req.query.resultStatus || null,
      dateFrom: req.query.dateFrom || null,
      dateTo: req.query.dateTo || null,
      sortBy: req.query.sortBy || "created_at",
      sortOrder: req.query.sortOrder || "desc",
      page,
      pageSize
    });

    const normalizedItems = items.map((item) => ({
      ...item,
      details:
        typeof item.details === "string" && item.details
          ? JSON.parse(item.details)
          : item.details
    }));

    res.json({
      items: normalizedItems,
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.use("/", adminCatalogRoutes);
router.use("/", adminRollingStockRoutes);

export default router;
