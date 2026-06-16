import { Router } from "express";
import { pingDatabase } from "../db/connection.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const database = await pingDatabase();

    res.json({
      status: "ok",
      service: "railway-ticket-system-api",
      database,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

export default router;
