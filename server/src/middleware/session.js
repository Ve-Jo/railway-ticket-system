import session from "express-session";
import { env } from "../config/env.js";

export const sessionMiddleware = session({
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 1000 * 60 * 60 * 8
  }
});
