import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import apiRoutes from "./routes/index.js";
import { sessionMiddleware } from "./middleware/session.js";
import { notFoundHandler } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.clientOrigin,
      credentials: true
    })
  );
  app.use(express.json());
  app.use(sessionMiddleware);

  app.get("/", (req, res) => {
    res.json({
      name: "railway-ticket-system-api",
      message: "API scaffold is running"
    });
  });

  app.use("/api", apiRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
