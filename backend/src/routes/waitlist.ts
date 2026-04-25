import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { generateTicketCode, generateQRData } from "../lib/qr.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// POST /api/waitlist/:eventId/join - Join event waitlist
router.post("/:eventId/join", authenticate, async (req, res) => {
  try {
    const booking = await prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: req.params.eventId as string },
        include: { seatTiers: true },
      });

      if (!event) {
        throw new Error("NOT_FOUND:Event not found");
      }

      if (event.status !== "PUBLISHED") {
        throw new Error("INVALID_EVENT:Event is not available for waitlist");
      }

      const isSoldOut =
        event.seatTiers.length > 0
          ? event.seatTiers.every((tier) => tier.soldCount >= tier.capacity)
          : event.soldCount >= event.capacity;

      if (!isSoldOut) {
        throw new Error("NOT_SOLD_OUT:Event is not sold out");
      }

      const existingBooking = await tx.booking.findFirst({
        where: {
          userId: req.user!.userId,
          eventId: event.id,
          status: {
            in: ["CONFIRMED", "WAITLISTED"],
          },
        },
      });

      if (existingBooking) {
        throw new Error("DUPLICATE:You already have a confirmed or waitlisted booking for this event");
      }

      const ticketCode = generateTicketCode();
      const qrCodeData = generateQRData(ticketCode);

      return tx.booking.create({
        data: {
          ticketCode,
          qrCodeData,
          userId: req.user!.userId,
          eventId: event.id,
          pricePaid: 0,
          discountAmount: 0,
          status: "WAITLISTED",
        },
      });
    });

    const position = await prisma.booking.count({
      where: {
        eventId: booking.eventId,
        status: "WAITLISTED",
        createdAt: {
          lte: booking.createdAt,
        },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        booking,
        position,
      },
      message: "Joined waitlist successfully",
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Error joining waitlist:", err);

    if (err.message?.startsWith("NOT_FOUND:")) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: err.message.split(":")[1],
      });
    }

    if (err.message?.startsWith("INVALID_EVENT:")) {
      return res.status(400).json({
        success: false,
        error: "INVALID_EVENT",
        message: err.message.split(":")[1],
      });
    }

    if (err.message?.startsWith("NOT_SOLD_OUT:")) {
      return res.status(400).json({
        success: false,
        error: "NOT_SOLD_OUT",
        message: err.message.split(":")[1],
      });
    }

    if (err.message?.startsWith("DUPLICATE:")) {
      return res.status(409).json({
        success: false,
        error: "DUPLICATE",
        message: err.message.split(":")[1],
      });
    }

    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to join waitlist",
    });
  }
});

// GET /api/waitlist/:eventId/position - Get user's current waitlist position
router.get("/:eventId/position", authenticate, async (req, res) => {
  try {
    const booking = await prisma.booking.findFirst({
      where: {
        userId: req.user!.userId,
        eventId: req.params.eventId as string,
        status: "WAITLISTED",
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: "Waitlist booking not found",
      });
    }

    const position = await prisma.booking.count({
      where: {
        eventId: booking.eventId,
        status: "WAITLISTED",
        createdAt: {
          lte: booking.createdAt,
        },
      },
    });

    res.json({
      success: true,
      data: {
        booking,
        position,
      },
    });
  } catch (error) {
    console.error("Error fetching waitlist position:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to fetch waitlist position",
    });
  }
});

// DELETE /api/waitlist/:eventId/leave - Leave waitlist
router.delete("/:eventId/leave", authenticate, async (req, res) => {
  try {
    const booking = await prisma.booking.findFirst({
      where: {
        userId: req.user!.userId,
        eventId: req.params.eventId as string,
        status: "WAITLISTED",
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: "Waitlist booking not found",
      });
    }

    await prisma.booking.delete({
      where: { id: booking.id },
    });

    res.json({
      success: true,
      message: "Left waitlist successfully",
    });
  } catch (error) {
    console.error("Error leaving waitlist:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to leave waitlist",
    });
  }
});

export default router;
