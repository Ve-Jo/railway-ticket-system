import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT) || 3000,
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  sessionSecret: process.env.SESSION_SECRET || "development-session-secret",
  dbHost: process.env.DB_HOST || "127.0.0.1",
  dbPort: Number(process.env.DB_PORT) || 3306,
  dbUser: process.env.DB_USER || "root",
  dbPassword: process.env.DB_PASSWORD || "",
  dbName: process.env.DB_NAME || "railway_ticket_system",
  tripGenerationHorizonDays: Number(process.env.TRIP_GENERATION_HORIZON_DAYS) || 7,
  tripAutofillEnabled: process.env.TRIP_AUTOFILL_ENABLED !== "false",
  tripAutofillMinLoad: Number(process.env.TRIP_AUTOFILL_MIN_LOAD) || 0.18,
  tripAutofillMaxLoad: Number(process.env.TRIP_AUTOFILL_MAX_LOAD) || 0.72,
  tripAutofillReservedShare: Number(process.env.TRIP_AUTOFILL_RESERVED_SHARE) || 0.2,
  tripAutofillPassengerPoolSize: Number(process.env.TRIP_AUTOFILL_PASSENGER_POOL_SIZE) || 12
};
