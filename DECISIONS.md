1. Overview
   Implement:
   Ticket transfer (immediate ownership change)
   Event waitlist (queue + auto-allocation)
2. Ticket Transfer Design

Key decisions:

Use existing transfer.ts utility (extend if needed).
Identify recipient via email → user lookup.
Transfer = update booking.userId.

Rules enforced:

Only CONFIRMED bookings.
Recipient must exist.
Remove ticket from sender automatically (ownership change).

QR Code

Already tied to booking → no change needed.

Error handling:

User not found → "Recipient not found"
Cancelled ticket → "Cannot transfer cancelled ticket" 3. Waitlist Design

Data model (if not already present):

Waitlist table:
id
eventId
userId
createdAt (for queue order)

Queue logic:

FIFO using createdAt

Flow:

Event sold out → allow waitlist join
On cancellation:
Find next waitlisted user
Create confirmed booking
Remove from waitlist

User features:

Join waitlist
Leave waitlist
View position 4. Assumptions
One waitlist entry per user per event
Auto-allocation happens immediately on cancellation
No email notifications required 5. Risks / Edge Cases
Duplicate waitlist entries → prevent
Race conditions → assume low concurrency (acceptable for assessment)
Capacity sync → reuse capacity.ts
