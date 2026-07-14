# Story 1 – Ticket Transfer

## Existing Design

- Booking owns ticket information.
- QR code already exists.
- Transfer utility exists.

## Decision

Reuse Booking instead of creating a new Ticket.

Transfer ownership by updating booking.userId.

## Why

- Minimal schema changes.
- Keeps QR code.
- Reuses existing booking flow.
- Lower maintenance cost.

---

# Story 2 – Waitlist

## Existing Design

Capacity checking already exists.

Cancellation already exists.

## Decision

Introduce FIFO waitlist.

On cancellation

cancel booking

↓

check waitlist

↓

allocate booking

↓

remove waitlist entry

## Why

Simple.

No scheduler.

No background workers.

Immediate allocation satisfies requirements.
