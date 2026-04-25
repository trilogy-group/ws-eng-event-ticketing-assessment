import { randomUUID } from "crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { generateToken } from "../src/lib/jwt.js";
import { prisma } from "../src/lib/prisma.js";

type Role = "ORGANIZER" | "ATTENDEE";

function uniqueValue(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

async function createUser(role: Role = "ATTENDEE") {
  return prisma.user.create({
    data: {
      email: `${uniqueValue(role.toLowerCase())}@example.com`,
      password: "password123",
      name: uniqueValue("User"),
      role,
    },
  });
}

async function createEvent(organizerId: string, overrides?: Partial<{ capacity: number; soldCount: number; status: string }>) {
  return prisma.event.create({
    data: {
      name: uniqueValue("Event"),
      description: "A sufficiently long description for integration testing.",
      date: new Date("2027-01-15T19:00:00.000Z"),
      time: "19:00",
      venue: "Integration Test Venue",
      price: 100,
      capacity: overrides?.capacity ?? 10,
      soldCount: overrides?.soldCount ?? 0,
      status: overrides?.status ?? "PUBLISHED",
      refundPolicy: "TIERED",
      serviceFeePercent: 5,
      category: "OTHER",
      organizerId,
    },
  });
}

async function createBooking(
  userId: string,
  eventId: string,
  overrides?: Partial<{
    status: string;
    pricePaid: number;
    discountAmount: number;
    createdAt: Date;
    seatTierId: string | null;
  }>
) {
  return prisma.booking.create({
    data: {
      ticketCode: uniqueValue("ticket"),
      qrCodeData: uniqueValue("qr"),
      userId,
      eventId,
      status: overrides?.status ?? "CONFIRMED",
      pricePaid: overrides?.pricePaid ?? 100,
      discountAmount: overrides?.discountAmount ?? 0,
      seatTierId: overrides?.seatTierId ?? null,
      createdAt: overrides?.createdAt,
    },
  });
}

function authHeader(user: { id: string; email: string; role: string }) {
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role as Role,
  });

  return { Authorization: `Bearer ${token}` };
}

describe("transfer API", () => {
  it("transfers a confirmed booking to another user and cancels the original booking", async () => {
    const organizer = await createUser("ORGANIZER");
    const sender = await createUser("ATTENDEE");
    const recipient = await createUser("ATTENDEE");
    const event = await createEvent(organizer.id, { capacity: 5, soldCount: 1 });

    const originalBooking = await createBooking(sender.id, event.id, {
      status: "CONFIRMED",
      pricePaid: 100,
    });

    const response = await request(app)
      .post(`/api/bookings/${originalBooking.id}/transfer`)
      .set(authHeader(sender))
      .send({ recipientEmail: recipient.email });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: `Booking transferred successfully to ${recipient.email}`,
      data: {
        user: {
          id: recipient.id,
          email: recipient.email,
        },
        event: {
          id: event.id,
          name: event.name,
        },
        status: "CONFIRMED",
        pricePaid: 100,
      },
    });

    const cancelledOriginal = await prisma.booking.findUnique({
      where: { id: originalBooking.id },
    });
    expect(cancelledOriginal?.status).toBe("CANCELLED");
    expect(cancelledOriginal?.refundAmount).toBe(0);
    expect(cancelledOriginal?.cancelledAt).not.toBeNull();

    const transferredBooking = await prisma.booking.findFirst({
      where: {
        userId: recipient.id,
        eventId: event.id,
        status: "CONFIRMED",
      },
    });

    expect(transferredBooking).not.toBeNull();
    expect(transferredBooking?.id).not.toBe(originalBooking.id);
    expect(transferredBooking?.ticketCode).not.toBe(originalBooking.ticketCode);
    expect(transferredBooking?.pricePaid).toBe(originalBooking.pricePaid);

    const refreshedEvent = await prisma.event.findUnique({
      where: { id: event.id },
    });
    expect(refreshedEvent?.soldCount).toBe(1);
  });

  it("rejects transfers when the recipient already has a waitlisted booking for the same event", async () => {
    const organizer = await createUser("ORGANIZER");
    const sender = await createUser("ATTENDEE");
    const recipient = await createUser("ATTENDEE");
    const holder = await createUser("ATTENDEE");

    const event = await createEvent(organizer.id, { capacity: 1, soldCount: 1 });

    await createBooking(sender.id, event.id, {
      status: "CONFIRMED",
      pricePaid: 100,
    });

    await createBooking(recipient.id, event.id, {
      status: "WAITLISTED",
      pricePaid: 0,
    });

    await createBooking(holder.id, event.id, {
      status: "CONFIRMED",
      pricePaid: 100,
    });

    const senderBooking = await prisma.booking.findFirstOrThrow({
      where: {
        userId: sender.id,
        eventId: event.id,
        status: "CONFIRMED",
      },
    });

    const response = await request(app)
      .post(`/api/bookings/${senderBooking.id}/transfer`)
      .set(authHeader(sender))
      .send({ recipientEmail: recipient.email });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      success: false,
      error: "DUPLICATE",
      message: "Recipient already has a confirmed or waitlisted booking for this event",
    });
  });

  it("rejects attempts to transfer another user's booking", async () => {
    const organizer = await createUser("ORGANIZER");
    const owner = await createUser("ATTENDEE");
    const attacker = await createUser("ATTENDEE");
    const recipient = await createUser("ATTENDEE");
    const event = await createEvent(organizer.id, { capacity: 5, soldCount: 1 });

    const booking = await createBooking(owner.id, event.id, {
      status: "CONFIRMED",
    });

    const response = await request(app)
      .post(`/api/bookings/${booking.id}/transfer`)
      .set(authHeader(attacker))
      .send({ recipientEmail: recipient.email });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      error: "FORBIDDEN",
      message: "You can only transfer your own bookings",
    });
  });
});

describe("waitlist API", () => {
  it("joins a sold-out event waitlist and returns the correct position", async () => {
    const organizer = await createUser("ORGANIZER");
    const holder = await createUser("ATTENDEE");
    const existingWaitlistedUser = await createUser("ATTENDEE");
    const joiningUser = await createUser("ATTENDEE");

    const event = await createEvent(organizer.id, { capacity: 1, soldCount: 1 });

    await createBooking(holder.id, event.id, {
      status: "CONFIRMED",
      pricePaid: 100,
    });

    await createBooking(existingWaitlistedUser.id, event.id, {
      status: "WAITLISTED",
      pricePaid: 0,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
    });

    const response = await request(app)
      .post(`/api/waitlist/${event.id}/join`)
      .set(authHeader(joiningUser))
      .send();

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: "Joined waitlist successfully",
      data: {
        position: 2,
        booking: {
          userId: joiningUser.id,
          eventId: event.id,
          status: "WAITLISTED",
          pricePaid: 0,
        },
      },
    });
  });

  it("returns the current waitlist position for the authenticated user", async () => {
    const organizer = await createUser("ORGANIZER");
    const firstWaitlistedUser = await createUser("ATTENDEE");
    const secondWaitlistedUser = await createUser("ATTENDEE");

    const event = await createEvent(organizer.id, { capacity: 1, soldCount: 1 });

    await createBooking(firstWaitlistedUser.id, event.id, {
      status: "WAITLISTED",
      pricePaid: 0,
      createdAt: new Date("2027-01-01T00:00:00.000Z"),
    });

    const targetBooking = await createBooking(secondWaitlistedUser.id, event.id, {
      status: "WAITLISTED",
      pricePaid: 0,
      createdAt: new Date("2027-01-01T00:01:00.000Z"),
    });

    const response = await request(app)
      .get(`/api/waitlist/${event.id}/position`)
      .set(authHeader(secondWaitlistedUser));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        position: 2,
        booking: {
          id: targetBooking.id,
          userId: secondWaitlistedUser.id,
          eventId: event.id,
          status: "WAITLISTED",
        },
      },
    });
  });

  it("leaves the waitlist and removes the booking", async () => {
    const organizer = await createUser("ORGANIZER");
    const waitlistedUser = await createUser("ATTENDEE");
    const event = await createEvent(organizer.id, { capacity: 1, soldCount: 1 });

    const booking = await createBooking(waitlistedUser.id, event.id, {
      status: "WAITLISTED",
      pricePaid: 0,
    });

    const response = await request(app)
      .delete(`/api/waitlist/${event.id}/leave`)
      .set(authHeader(waitlistedUser));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Left waitlist successfully",
    });

    const deletedBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
    });
    expect(deletedBooking).toBeNull();
  });

  it("rejects waitlist joins when the event is not sold out", async () => {
    const organizer = await createUser("ORGANIZER");
    const joiningUser = await createUser("ATTENDEE");
    const event = await createEvent(organizer.id, { capacity: 5, soldCount: 1 });

    const response = await request(app)
      .post(`/api/waitlist/${event.id}/join`)
      .set(authHeader(joiningUser))
      .send();

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: "NOT_SOLD_OUT",
      message: "Event is not sold out",
    });
  });
});
