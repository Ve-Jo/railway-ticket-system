import { Router } from "express";
import bcrypt from "bcryptjs";
import { query } from "../db/connection.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { writeOperationLog } from "../services/operationLogs.js";

const router = Router();

function buildSessionUser(user) {
  return {
    id: user.id,
    login: user.username,
    email: user.email,
    fullName: user.full_name,
    role: user.role_code
  };
}

router.get("/session", (req, res) => {
  res.json({
    authenticated: Boolean(req.session.user),
    user: req.session.user || null
  });
});

router.post("/login", async (req, res, next) => {
  try {
    const { login, password } = req.body ?? {};

    if (!login || !password) {
      return res.status(400).json({
        message: "login and password are required"
      });
    }

    const users = await query(
      `
        SELECT
          users.id,
          users.username,
          users.email,
          users.full_name,
          users.password_hash,
          users.is_active,
          roles.code AS role_code
        FROM users
        INNER JOIN roles ON roles.id = users.role_id
        WHERE users.username = ? OR users.email = ?
        LIMIT 1
      `,
      [login, login]
    );

    const user = users[0];
    if (!user || !user.is_active) {
      return res.status(401).json({
        message: "Invalid credentials"
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        message: "Invalid credentials"
      });
    }

    req.session.user = buildSessionUser(user);

    await writeOperationLog({
      actorUserId: user.id,
      entityType: "user",
      entityId: user.id,
      action: "auth.login",
      resultStatus: "success",
      ipAddress: req.ip,
      details: { login }
    });

    return res.json({
      message: "Logged in successfully",
      user: req.session.user
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/register", async (req, res, next) => {
  try {
    const { username, login, email, fullName, name, password } = req.body ?? {};
    const normalizedLogin = username || login;
    const normalizedFullName = fullName || name;

    if (!normalizedLogin || !email || !normalizedFullName || !password) {
      return res.status(400).json({
        message: "login, email, fullName and password are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long"
      });
    }

    const existingUsers = await query(
      `
        SELECT id
        FROM users
        WHERE username = ? OR email = ?
        LIMIT 1
      `,
      [normalizedLogin, email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        message: "User with this username or email already exists"
      });
    }

    const passengerRoles = await query(
      `
        SELECT id, code
        FROM roles
        WHERE code = 'passenger'
        LIMIT 1
      `
    );

    const passengerRole = passengerRoles[0];
    if (!passengerRole) {
      return res.status(500).json({
        message: "Passenger role is not configured in the database"
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query(
      `
        INSERT INTO users (role_id, username, email, full_name, password_hash)
        VALUES (?, ?, ?, ?, ?)
      `,
      [passengerRole.id, normalizedLogin, email, normalizedFullName, passwordHash]
    );

    req.session.user = {
      id: result.insertId,
      login: normalizedLogin,
      email,
      fullName: normalizedFullName,
      role: passengerRole.code
    };

    await writeOperationLog({
      actorUserId: result.insertId,
      entityType: "user",
      entityId: result.insertId,
      action: "auth.register",
      resultStatus: "success",
      ipAddress: req.ip,
      details: { login: normalizedLogin, role: passengerRole.code }
    });

    return res.status(201).json({
      message: "Registered successfully",
      user: req.session.user
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/logout", (req, res, next) => {
  const actorUserId = req.session?.user?.id ?? null;
  req.session.destroy((error) => {
    if (error) {
      return next(error);
    }

    writeOperationLog({
      actorUserId,
      entityType: "user",
      entityId: actorUserId,
      action: "auth.logout",
      resultStatus: "success",
      ipAddress: req.ip
    });

    res.clearCookie("connect.sid");
    return res.status(204).send();
  });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({
    user: req.session.user
  });
});

export default router;
