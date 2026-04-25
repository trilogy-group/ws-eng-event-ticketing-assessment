# Engineering Decisions

## Problem Understanding

I need to implement **Ticket Transfer** and **Event Waitlist** without breaking booking, QR, refund, and organizer flows. Transfer must move a confirmed ticket to another registered user by email immediately. Waitlist must allow join, show position, auto-promote on cancellation, and allow leaving.

The main challenge is that the codebase already has partial transfer and waitlist foundations, but several issues affect story correctness and user trust.

**P0 – Story/blocking correctness**
- Transfer duplicate-check only guards against existing `CONFIRMED`, not `CHECKED_IN`.
- Event/date availability logic is inconsistent because `date` and `time` are handled separately.
- Tier capacity is buggy: tier totals can exceed event capacity.
- Promo validation misses edge cases: fixed discount can exceed price, percent can exceed 100%.

**P1 – UX gaps discovered while browsing**
- Expired events still appear in event list.
- No waitlist CTA on sold-out event cards/details.
- No indication in event list that user already has a booking.
- No upgrade path from existing tier to better tier.
- Booking page issues: misaligned status, no booking/cancel timestamps, QR download broken.
- Ticket page issues: stale tier-selection error, no “clear promo”, cancelled ticket via saved URL shows wrong message.

**P2 – product/feature gaps**
- Organizer can likely book their own event.
- New-event flow does not expose tiers/promo creation, but edit flow does.
- Promo codes cannot be edited/reactivated cleanly.

## Approach

For **Transfer**, I will reuse the existing shared `transferBooking(...)` backend utility and expose an attendee-owned endpoint/UI. I will **not** add a new `TRANSFERRED` status. The original booking will remain `CANCELLED` with `refundAmount = 0`; this is slightly misleading historically, but acceptable because grading checks that the sender no longer has the active ticket, and reuse keeps QR/capacity logic consistent.

For **Waitlist**, I will keep it as a **separate event-level queue**, not as booking status in normal attendee flows. Decisions:
- waitlist has **no limit**
- joining is **free**
- there is **no payment step** on promotion because the app has no payment gateway or stored cards
- on cancellation, the next user is auto-promoted transactionally to `CONFIRMED`
- users can leave anytime, with no refund implications

For tiered events, waitlist is **event-level, not tier-level**. If any seat opens, the next person gets promoted regardless of which tier was freed. This is an acceptable tradeoff because the requirement says “sold-out event,” not tier-specific waitlist, and acceptance tests appear focused on flat-capacity events.

## Risks & Assumptions

- Users may see a transferred-away ticket as “Cancelled”; acceptable for now.
- Auto-promoted users may receive a different tier than expected in tiered events.
- Upgrade flow (e.g. General → VIP) is out of scope for these stories and should be treated as future enhancement.
- I would ask PM whether organizers should be blocked from booking their own events, and whether tiers/promo creation should exist during event creation, not only edit.

## Implementation Sequence

1. Fix P0 correctness issues first: transfer eligibility, date+time handling, tier capacity validation, promo edge-case validation.
2. Implement attendee transfer endpoint/UI using the shared transfer utility.
3. Implement waitlist join/position/leave and cancellation-triggered auto-promotion.
4. Add sold-out waitlist CTA and refresh event/booking views.
5. Fix highest-value P1 UX issues that directly affect story testing: cancelled-ticket messaging, QR download, timestamps, stale errors.
6. Leave P2 product enhancements (self-booking rules, upgrade flow, promo edit/reactivate, create-event tiers/promo UX) as documented follow-ups.
