import { Router } from "express";
import healthRoutes from "./health.routes.js";
import authRoutes from "./auth.routes.js";
import stationsRoutes from "./stations.routes.js";
import tripsRoutes from "./trips.routes.js";
import bookingsRoutes from "./bookings.routes.js";
import paymentsRoutes from "./payments.routes.js";
import ticketsRoutes from "./tickets.routes.js";
import refundsRoutes from "./refunds.routes.js";
import cashierRoutes from "./cashier.routes.js";
import adminRoutes from "./admin.routes.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/stations", stationsRoutes);
router.use("/trips", tripsRoutes);
router.use("/bookings", bookingsRoutes);
router.use("/payments", paymentsRoutes);
router.use("/tickets", ticketsRoutes);
router.use("/refunds", refundsRoutes);
router.use("/cashier", cashierRoutes);
router.use("/admin", adminRoutes);

export default router;
