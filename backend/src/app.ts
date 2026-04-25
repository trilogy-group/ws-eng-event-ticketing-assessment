import cors from "cors";
import express from "express";
import authRoutes from "./routes/auth.js";
import bookingRoutes from "./routes/bookings.js";
import checkinRoutes from "./routes/checkin.js";
import dashboardRoutes from "./routes/dashboard.js";
import eventRoutes from "./routes/events.js";
import promoCodeRoutes from "./routes/promoCodes.js";
import tierRoutes from "./routes/tiers.js";
import waitlistRoutes from "./routes/waitlist.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
  app.use(express.json());

  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/events", eventRoutes);
  app.use("/api/events", tierRoutes);
  app.use("/api/events", promoCodeRoutes);
  app.use("/api/bookings", bookingRoutes);
  app.use("/api/checkin", checkinRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/waitlist", waitlistRoutes);

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: "NOT_FOUND",
      message: "Endpoint not found",
    });
  });

  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Something went wrong",
    });
  });

  return app;
}

export const app = createApp();
