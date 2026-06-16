import { Router } from "express";
import { query } from "../db/connection.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const search = String(req.query.search ?? "").trim();
    const searchPattern = `%${search}%`;

    const items = await query(
      `
        SELECT
          id,
          code,
          name,
          city
        FROM stations
        WHERE is_active = 1
          AND (
            ? = ''
            OR name LIKE ?
            OR city LIKE ?
            OR code LIKE ?
          )
        ORDER BY city ASC, name ASC
      `,
      [search, searchPattern, searchPattern, searchPattern]
    );

    res.json({ items });
  } catch (error) {
    next(error);
  }
});

export default router;
