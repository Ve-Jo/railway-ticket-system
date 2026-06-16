import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./config/env.js";
import apiRoutes from "./routes/index.js";
import { sessionMiddleware } from "./middleware/session.js";
import { notFoundHandler } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, "../../client/dist");

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

  if (process.env.NODE_ENV !== "production") {
    app.get("/", (req, res) => {
      res.json({
        name: "railway-ticket-system-api",
        message: "API scaffold is running"
      });
    });
  }

  app.use("/api", apiRoutes);

  if (process.env.NODE_ENV === "production") {
    app.use(express.static(clientDistPath));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        return next();
      }

      return res.sendFile(path.join(clientDistPath, "index.html"));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
