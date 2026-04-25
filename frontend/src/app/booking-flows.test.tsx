import type { ReactNode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Booking, Event, User } from "@/types";
import TicketPage from "./tickets/[id]/page";
import BookingsPage from "./bookings/page";
import EventPage from "./events/[id]/page";
import { useAuth } from "@/contexts/AuthContext";
import { bookingsAPI, eventsAPI, promoCodesAPI, waitlistAPI } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

jest.mock("next/navigation", () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/api", () => ({
  bookingsAPI: {
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    transfer: jest.fn(),
    cancel: jest.fn(),
    getRefundPreview: jest.fn(),
    getQR: jest.fn(),
  },
  eventsAPI: {
    list: jest.fn(),
    listAll: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getAttendees: jest.fn(),
  },
  promoCodesAPI: {
    list: jest.fn(),
    create: jest.fn(),
    validate: jest.fn(),
    delete: jest.fn(),
  },
  waitlistAPI: {
    join: jest.fn(),
    position: jest.fn(),
    leave: jest.fn(),
  },
}));

const mockPush = jest.fn();

const originalAttendee: User = {
  id: "user-original",
  email: "alice@example.com",
  name: "Alice Williams",
  role: "ATTENDEE",
  isVerified: true,
};

const recipientAttendee: User = {
  id: "user-recipient",
  email: "bob@example.com",
  name: "Bob Martinez",
  role: "ATTENDEE",
  isVerified: true,
};

function createEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "event-1",
    name: "Transferable Festival",
    description: "A test event for transfer and waitlist scenarios.",
    date: "2028-08-20T00:00:00.000Z",
    time: "2028-08-20T19:30:00.000Z",
    venue: "Test Arena",
    imageUrl: null,
    artistInfo: "Test Artist",
    category: "MUSIC",
    price: 49.99,
    capacity: 100,
    soldCount: 25,
    status: "PUBLISHED",
    refundPolicy: "TIERED",
    serviceFeePercent: 5,
    organizerId: "organizer-1",
    seatTiers: [],
    createdAt: "2028-01-01T00:00:00.000Z",
    updatedAt: "2028-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createBooking(overrides: Partial<Booking> = {}): Booking {
  const eventName = overrides.event?.name ?? "Transferable Festival";

  return {
    id: "booking-1",
    ticketCode: "ticket-12345678",
    qrCodeData: "ticket-qr-data",
    status: "CONFIRMED",
    pricePaid: 49.99,
    discountAmount: 0,
    refundAmount: 0,
    cancelledAt: null,
    checkedInAt: null,
    userId: originalAttendee.id,
    eventId: "event-1",
    seatTierId: null,
    promoCodeId: null,
    event: {
      id: overrides.event?.id ?? "event-1",
      name: eventName,
      date: overrides.event?.date ?? "2028-08-20T00:00:00.000Z",
      time: overrides.event?.time ?? "2028-08-20T19:30:00.000Z",
      venue: overrides.event?.venue ?? "Test Arena",
      imageUrl: overrides.event?.imageUrl ?? null,
      artistInfo: overrides.event?.artistInfo ?? "Test Artist",
      status: overrides.event?.status ?? "PUBLISHED",
      category: overrides.event?.category ?? "MUSIC",
      refundPolicy: overrides.event?.refundPolicy ?? "TIERED",
      serviceFeePercent: overrides.event?.serviceFeePercent ?? 5,
    },
    seatTier: null,
    promoCode: null,
    createdAt: "2028-01-01T00:00:00.000Z",
    updatedAt: "2028-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function mockAuthenticatedUser(user: User = originalAttendee) {
  (useAuth as jest.Mock).mockReturnValue({
    user,
    token: "test-token",
    isLoading: false,
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
  });
}

describe("transfer and waitlist user journeys", () => {
  beforeEach(() => {
    cleanup();
    jest.resetAllMocks();
    mockPush.mockReset();

    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (useParams as jest.Mock).mockReturnValue({ id: "booking-1" });

    mockAuthenticatedUser();
    (promoCodesAPI.validate as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        id: "promo-1",
        code: "PROMO10",
        discountType: "PERCENTAGE",
        discountValue: 10,
        minPurchaseAmount: null,
        maxDiscountAmount: null,
      },
    });
  });

  it("Test 1: shows the transfer form on the ticket detail page", async () => {
    const booking = createBooking();

    (bookingsAPI.get as jest.Mock).mockResolvedValue({
      success: true,
      data: booking,
    });
    (bookingsAPI.getQR as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        qrCode: "data:image/png;base64,VALIDQR",
        ticketCode: booking.ticketCode,
      },
    });

    render(<TicketPage />);

    expect(await screen.findByRole("heading", { name: booking.event?.name })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /transfer ticket/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/recipient email/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^transfer$/i })).toBeInTheDocument();
  });

  it("Test 2: completes transfer successfully and the ticket no longer appears in the original attendee bookings", async () => {
    const booking = createBooking();
    const otherBooking = createBooking({
      id: "booking-2",
      ticketCode: "ticket-OTHER123",
      eventId: "event-2",
      event: {
        id: "event-2",
        name: "Another Event",
        date: "2028-09-10T00:00:00.000Z",
        time: "2028-09-10T19:00:00.000Z",
        venue: "Hall B",
        imageUrl: null,
        artistInfo: "Another Artist",
        status: "PUBLISHED",
        category: "MUSIC",
        refundPolicy: "TIERED",
        serviceFeePercent: 5,
      },
    });

    (bookingsAPI.get as jest.Mock).mockResolvedValue({
      success: true,
      data: booking,
    });
    (bookingsAPI.getQR as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        qrCode: "data:image/png;base64,VALIDQR",
        ticketCode: booking.ticketCode,
      },
    });
    (bookingsAPI.transfer as jest.Mock).mockResolvedValue({
      success: true,
      message: "Ticket transferred successfully.",
      data: createBooking({
        id: "booking-transferred",
        userId: recipientAttendee.id,
      }),
    });

    const user = userEvent.setup();

    render(<TicketPage />);

    await screen.findByRole("heading", { name: booking.event?.name });
    await user.type(screen.getByLabelText(/recipient email/i), recipientAttendee.email);
    await user.click(screen.getByRole("button", { name: /^transfer$/i }));

    expect(await screen.findByText(/ticket transferred successfully/i)).toBeInTheDocument();
    expect(bookingsAPI.transfer).toHaveBeenCalledWith("test-token", booking.id, {
      recipientEmail: recipientAttendee.email,
    });
    expect(screen.getByLabelText(/recipient email/i)).toHaveValue("");
    expect(screen.getByRole("button", { name: /^transfer$/i })).toBeDisabled();

    cleanup();

    (bookingsAPI.list as jest.Mock).mockResolvedValue({
      success: true,
      data: [otherBooking],
    });

    render(<BookingsPage />);

    expect(await screen.findByRole("heading", { name: /my bookings/i })).toBeInTheDocument();
    expect(await screen.findByText("Another Event")).toBeInTheDocument();
    expect(screen.queryByText("Transferable Festival")).not.toBeInTheDocument();
  });

  it("Test 3: shows the transferred ticket in the recipient bookings", async () => {
    mockAuthenticatedUser(recipientAttendee);

    (bookingsAPI.list as jest.Mock).mockResolvedValue({
      success: true,
      data: [
        createBooking({
          id: "booking-recipient",
          userId: recipientAttendee.id,
          event: {
            id: "event-1",
            name: "Transferable Festival",
            date: "2028-08-20T00:00:00.000Z",
            time: "2028-08-20T19:30:00.000Z",
            venue: "Test Arena",
            imageUrl: null,
            artistInfo: "Test Artist",
            status: "PUBLISHED",
            category: "MUSIC",
            refundPolicy: "TIERED",
            serviceFeePercent: 5,
          },
        }),
      ],
    });

    render(<BookingsPage />);

    expect(await screen.findByText("Transferable Festival")).toBeInTheDocument();
    expect(screen.getByText(/confirmed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view ticket/i })).toBeInTheDocument();
  });

  it("Test 4: shows an error when a non-existent recipient email is entered", async () => {
    const booking = createBooking();

    (bookingsAPI.get as jest.Mock).mockResolvedValue({
      success: true,
      data: booking,
    });
    (bookingsAPI.getQR as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        qrCode: "data:image/png;base64,VALIDQR",
        ticketCode: booking.ticketCode,
      },
    });
    (bookingsAPI.transfer as jest.Mock).mockRejectedValue(new Error("Recipient not found"));

    const user = userEvent.setup();

    render(<TicketPage />);

    await screen.findByRole("heading", { name: booking.event?.name });
    await user.type(screen.getByLabelText(/recipient email/i), "missing@example.com");
    await user.click(screen.getByRole("button", { name: /^transfer$/i }));

    expect(await screen.findByText(/recipient not found/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^transfer$/i })).not.toBeDisabled();
  });

  it("Test 5: hides transfer controls for cancelled bookings", async () => {
    const cancelledBooking = createBooking({
      status: "CANCELLED",
      cancelledAt: "2028-07-01T00:00:00.000Z",
    });

    (bookingsAPI.get as jest.Mock).mockResolvedValue({
      success: true,
      data: cancelledBooking,
    });

    render(<TicketPage />);

    expect(await screen.findByText(/this ticket is no longer valid/i)).toBeInTheDocument();
    expect(screen.getByText(/status: cancelled/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /transfer ticket/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/recipient email/i)).not.toBeInTheDocument();
    expect(bookingsAPI.getQR).not.toHaveBeenCalled();
  });

  it("Test 6: shows a valid QR code on the transferred recipient ticket", async () => {
    mockAuthenticatedUser(recipientAttendee);

    const transferredBooking = createBooking({
      id: "booking-transferred",
      userId: recipientAttendee.id,
    });

    (bookingsAPI.get as jest.Mock).mockResolvedValue({
      success: true,
      data: transferredBooking,
    });
    (bookingsAPI.getQR as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        qrCode: "data:image/png;base64,TRANSFERREDQR",
        ticketCode: transferredBooking.ticketCode,
      },
    });

    render(<TicketPage />);

    const qrCode = await screen.findByAltText(/ticket qr code/i);

    expect(qrCode).toBeInTheDocument();
    expect(qrCode).toHaveAttribute("src", "data:image/png;base64,TRANSFERREDQR");
    expect(screen.getByRole("button", { name: /download qr code/i })).toBeInTheDocument();
  });

  it("Test 7: shows an error when trying to transfer a ticket to yourself", async () => {
    const booking = createBooking();

    (bookingsAPI.get as jest.Mock).mockResolvedValue({
      success: true,
      data: booking,
    });
    (bookingsAPI.getQR as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        qrCode: "data:image/png;base64,VALIDQR",
        ticketCode: booking.ticketCode,
      },
    });
    (bookingsAPI.transfer as jest.Mock).mockRejectedValue(new Error("You cannot transfer a booking to yourself"));

    const user = userEvent.setup();

    render(<TicketPage />);

    await screen.findByRole("heading", { name: booking.event?.name });
    await user.type(screen.getByLabelText(/recipient email/i), originalAttendee.email);
    await user.click(screen.getByRole("button", { name: /^transfer$/i }));

    expect(await screen.findByText(/you cannot transfer a booking to yourself/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^transfer$/i })).not.toBeDisabled();
  });

  it("Test 8: joins the waitlist from the sold-out event page and shows the returned position", async () => {
    (useParams as jest.Mock).mockReturnValue({ id: "event-sold-out" });

    const soldOutEvent = createEvent({
      id: "event-sold-out",
      name: "Exclusive Chef's Table Dinner",
      capacity: 2,
      soldCount: 2,
    });

    (eventsAPI.get as jest.Mock).mockResolvedValue({
      success: true,
      data: soldOutEvent,
    });
    (waitlistAPI.position as jest.Mock).mockRejectedValue(new Error("Waitlist booking not found"));
    (waitlistAPI.join as jest.Mock).mockResolvedValue({
      success: true,
      message: "Joined waitlist successfully.",
      data: {
        booking: createBooking({
          id: "waitlist-booking-1",
          status: "WAITLISTED",
          eventId: soldOutEvent.id,
          event: {
            id: soldOutEvent.id,
            name: soldOutEvent.name,
            date: soldOutEvent.date,
            time: soldOutEvent.time,
            venue: soldOutEvent.venue,
            imageUrl: soldOutEvent.imageUrl,
            artistInfo: soldOutEvent.artistInfo,
            status: soldOutEvent.status,
            category: soldOutEvent.category,
            refundPolicy: soldOutEvent.refundPolicy,
            serviceFeePercent: soldOutEvent.serviceFeePercent,
          },
        }),
        position: 1,
      },
    });

    const user = userEvent.setup();

    render(<EventPage />);

    expect(await screen.findByRole("heading", { name: soldOutEvent.name })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /join waitlist/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /join waitlist/i }));

    await waitFor(() => {
      expect(waitlistAPI.join).toHaveBeenCalledWith("test-token", soldOutEvent.id);
    });

    expect(await screen.findByText(/joined waitlist successfully/i)).toBeInTheDocument();
    expect(screen.getByText(/your waitlist position/i)).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /leave waitlist/i })).toBeInTheDocument();
  });

  it("Test 9: displays the existing waitlist position", async () => {
    (useParams as jest.Mock).mockReturnValue({ id: "event-sold-out" });

    const soldOutEvent = createEvent({
      id: "event-sold-out",
      name: "Exclusive Chef's Table Dinner",
      capacity: 2,
      soldCount: 2,
    });

    (eventsAPI.get as jest.Mock).mockResolvedValue({
      success: true,
      data: soldOutEvent,
    });
    (waitlistAPI.position as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        booking: createBooking({
          id: "waitlist-booking-2",
          status: "WAITLISTED",
          eventId: soldOutEvent.id,
        }),
        position: 2,
      },
    });

    render(<EventPage />);

    expect(await screen.findByText(/your waitlist position/i)).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /leave waitlist/i })).toBeInTheDocument();
  });

  it("Test 10: shows the duplicate waitlist error and keeps the join action available", async () => {
    (useParams as jest.Mock).mockReturnValue({ id: "event-sold-out" });

    const soldOutEvent = createEvent({
      id: "event-sold-out",
      name: "Exclusive Chef's Table Dinner",
      capacity: 2,
      soldCount: 2,
    });

    (eventsAPI.get as jest.Mock).mockResolvedValue({
      success: true,
      data: soldOutEvent,
    });
    (waitlistAPI.position as jest.Mock).mockRejectedValue(new Error("Waitlist booking not found"));
    (waitlistAPI.join as jest.Mock).mockRejectedValue(
      new Error("You already have a confirmed or waitlisted booking for this event")
    );

    const user = userEvent.setup();

    render(<EventPage />);

    await waitFor(() => {
      expect(waitlistAPI.position).toHaveBeenCalledWith("test-token", soldOutEvent.id);
    });

    const joinWaitlistButton = await screen.findByRole("button", { name: /join waitlist/i });
    expect(joinWaitlistButton).toBeInTheDocument();

    await user.click(joinWaitlistButton);

    expect(
      await screen.findByText(/you already have a confirmed or waitlisted booking for this event/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /join waitlist/i })).toBeInTheDocument();
    expect(screen.queryByText(/your waitlist position/i)).not.toBeInTheDocument();
  });

  it("Test 11: does not offer waitlist actions for a cancelled sold-out event", async () => {
    (useParams as jest.Mock).mockReturnValue({ id: "event-cancelled" });

    const cancelledEvent = createEvent({
      id: "event-cancelled",
      name: "Cancelled Private Dinner",
      capacity: 2,
      soldCount: 2,
      status: "CANCELLED",
    });

    (eventsAPI.get as jest.Mock).mockResolvedValue({
      success: true,
      data: cancelledEvent,
    });

    render(<EventPage />);

    expect(await screen.findByRole("heading", { name: cancelledEvent.name })).toBeInTheDocument();
    expect(screen.getAllByText(/event cancelled/i)).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /join waitlist/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /event cancelled/i })).toBeDisabled();
    expect(waitlistAPI.position).not.toHaveBeenCalled();
  });

  it("Test 12: shows a confirmed ticket for a user who was automatically promoted from the waitlist after a cancellation", async () => {
    mockAuthenticatedUser(recipientAttendee);

    (bookingsAPI.list as jest.Mock).mockResolvedValue({
      success: true,
      data: [
        createBooking({
          id: "booking-promoted",
          userId: recipientAttendee.id,
          status: "CONFIRMED",
          eventId: "event-sold-out",
          event: {
            id: "event-sold-out",
            name: "Exclusive Chef's Table Dinner",
            date: "2028-08-30T00:00:00.000Z",
            time: "2028-08-30T20:00:00.000Z",
            venue: "Private Kitchen",
            imageUrl: null,
            artistInfo: "Chef Demo",
            status: "PUBLISHED",
            category: "OTHER",
            refundPolicy: "FULL_REFUND",
            serviceFeePercent: 5,
          },
        }),
      ],
    });

    render(<BookingsPage />);

    expect(await screen.findByText("Exclusive Chef's Table Dinner")).toBeInTheDocument();
    expect(screen.getByText(/confirmed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view ticket/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /leave waitlist/i })).not.toBeInTheDocument();
  });

  it("Test 13: lets a user voluntarily leave the waitlist from the bookings page", async () => {
    const waitlistedBooking = createBooking({
      id: "waitlist-booking-3",
      status: "WAITLISTED",
      eventId: "event-sold-out",
      event: {
        id: "event-sold-out",
        name: "Exclusive Chef's Table Dinner",
        date: "2028-08-30T00:00:00.000Z",
        time: "2028-08-30T20:00:00.000Z",
        venue: "Private Kitchen",
        imageUrl: null,
        artistInfo: "Chef Demo",
        status: "PUBLISHED",
        category: "OTHER",
        refundPolicy: "FULL_REFUND",
        serviceFeePercent: 5,
      },
    });

    (bookingsAPI.list as jest.Mock).mockResolvedValue({
      success: true,
      data: [waitlistedBooking],
    });
    (waitlistAPI.position as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        booking: waitlistedBooking,
        position: 3,
      },
    });
    (waitlistAPI.leave as jest.Mock).mockResolvedValue({
      success: true,
      message: "Left waitlist successfully.",
    });

    const user = userEvent.setup();

    render(<BookingsPage />);

    expect(await screen.findByText("Exclusive Chef's Table Dinner")).toBeInTheDocument();
    expect(await screen.findByText(/position: #3/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /leave waitlist/i }));
    expect(await screen.findByText(/are you sure you want to leave the waitlist/i)).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /leave waitlist/i })[1]);

    await waitFor(() => {
      expect(waitlistAPI.leave).toHaveBeenCalledWith("test-token", "event-sold-out");
    });

    await waitFor(() => {
      expect(screen.queryByText("Exclusive Chef's Table Dinner")).not.toBeInTheDocument();
    });

    expect(screen.getByText(/no bookings yet/i)).toBeInTheDocument();
  });

  it("Test 14: lets a user leave the waitlist from the event page and returns to the join state", async () => {
    (useParams as jest.Mock).mockReturnValue({ id: "event-sold-out" });

    const soldOutEvent = createEvent({
      id: "event-sold-out",
      name: "Exclusive Chef's Table Dinner",
      capacity: 2,
      soldCount: 2,
    });

    (eventsAPI.get as jest.Mock).mockResolvedValue({
      success: true,
      data: soldOutEvent,
    });
    (waitlistAPI.position as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        booking: createBooking({
          id: "waitlist-booking-4",
          status: "WAITLISTED",
          eventId: soldOutEvent.id,
        }),
        position: 2,
      },
    });
    (waitlistAPI.leave as jest.Mock).mockResolvedValue({
      success: true,
      message: "Left waitlist successfully.",
    });

    const user = userEvent.setup();

    render(<EventPage />);

    expect(await screen.findByText(/your waitlist position/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /leave waitlist/i }));
    expect(await screen.findByText(/you will lose your current position/i)).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /leave waitlist/i })[1]);

    await waitFor(() => {
      expect(waitlistAPI.leave).toHaveBeenCalledWith("test-token", soldOutEvent.id);
    });

    expect(await screen.findByText(/left waitlist successfully/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /join waitlist/i })).toBeInTheDocument();
    expect(screen.queryByText(/your waitlist position/i)).not.toBeInTheDocument();
  });
});
