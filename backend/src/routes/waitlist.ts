import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { generateQRData, generateTicketCode } from "../lib/qr.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

/**
 * 🔥 AUTO ALLOCATION FUNCTION (Test 9)
 * Call this when a ticket is cancelled
 */
export const allocateNextFromWaitlist = async (eventId: string) => {
  return prisma.$transaction(async (tx) => {
    // Get first user in waitlist
    const next = await tx.waitlist.findFirst({
      where: { eventId },
      orderBy: { position: "asc" },
    });

    if (!next) return null;

    // Create booking for that user
    const ticketCode = generateTicketCode();
    const qrCodeData = generateQRData(ticketCode);

    const booking = await tx.booking.create({
      data: {
        ticketCode,
        qrCodeData,
        userId: next.userId,
        eventId,
        status: "CONFIRMED",
      },
    });

    // Remove from waitlist
    await tx.waitlist.delete({
      where: { id: next.id },
    });

    // Shift remaining users
    await tx.waitlist.updateMany({
      where: {
        eventId,
        position: { gt: next.position },
      },
      data: {
        position: { decrement: 1 },
      },
    });

    return booking;
  });
};

/**
 * POST /api/waitlist/:eventId
 * Join waitlist
 */
router.post("/:eventId", authenticate, async (req, res) => {
  try {
    const eventIdParam = req.params.eventId;
    const eventId = Array.isArray(eventIdParam) ? eventIdParam[0] : eventIdParam;

    if (!eventId) {
      return res.status(400).json({ success: false, message: "Invalid eventId" });
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } });

    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    if (event.soldCount < event.capacity) {
      return res.status(400).json({
        success: false,
        message: "Event is not sold out",
      });
    }

    const existing = await prisma.waitlist.findUnique({
      where: {
        userId_eventId: {
          userId: req.user!.userId,
          eventId,
        },
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Already in waitlist",
      });
    }

    const entry = await prisma.$transaction(async (tx) => {
      const last = await tx.waitlist.findFirst({
        where: { eventId },
        orderBy: { position: "desc" },
      });

      const position = last ? last.position + 1 : 1;

      return tx.waitlist.create({
        data: {
          userId: req.user!.userId,
          eventId,
          position,
        },
      });
    });

    return res.json({
      success: true,
      data: { position: entry.position },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Error joining waitlist" });
  }
});

/**
 * GET /api/waitlist/:eventId
 */
router.get("/:eventId", authenticate, async (req, res) => {
  try {
    const eventIdParam = req.params.eventId;
    const eventId = Array.isArray(eventIdParam) ? eventIdParam[0] : eventIdParam;

    const entry = await prisma.waitlist.findUnique({
      where: {
        userId_eventId: {
          userId: req.user!.userId,
          eventId,
        },
      },
    });

    if (!entry) {
      return res.status(404).json({ success: false });
    }

    return res.json({
      success: true,
      data: { position: entry.position },
    });
  } catch {
    return res.status(500).json({ success: false });
  }
});

/**
 * DELETE /api/waitlist/:eventId
 * User leaves waitlist (Test 10)
 */
router.delete("/:eventId", authenticate, async (req, res) => {
  try {
    const eventIdParam = req.params.eventId;
    const eventId = Array.isArray(eventIdParam) ? eventIdParam[0] : eventIdParam;

    const entry = await prisma.waitlist.findUnique({
      where: {
        userId_eventId: {
          userId: req.user!.userId,
          eventId,
        },
      },
    });

    if (!entry) {
      return res.status(404).json({ success: false, message: "Not in waitlist" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.waitlist.delete({
        where: { id: entry.id },
      });

      await tx.waitlist.updateMany({
        where: {
          eventId,
          position: { gt: entry.position },
        },
        data: {
          position: { decrement: 1 },
        },
      });
    });

    return res.json({
      success: true,
      message: "Left waitlist",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to leave waitlist",
    });
  }
});

export default router;
