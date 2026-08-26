# Engineering Decisions

Document your implementation approach, key decisions, and any questions or assumptions here. This is your primary planning artifact — write it before you start coding.

Keep it concise (~500 words). We care about the reasoning behind your choices, not the length.

---

## Problem Understanding

*What are you building? What are the key challenges? What's unclear or missing from the requirements?*

I am building two attendee facing features: ticket transfer and an event waitlist.
For ticket transfer, I need to allow an attendee with a confirmed booking to transfer their ticket to another registered user by entering the recipient's email address. The transfer must happen immediately. After a successful transfer, the original attendee should no longer have the ticket in their bookings, while the recipient should see the transferred ticket in their bookings and be able to view its ticket details and valid QR code for check in. The transfer must also reject invalid recipients and cancelled bookings.
For the waitlist, I need to allow attendees to join a waitlist when an event is sold out, see their current position and leave the waitlist voluntarily. When a ticket becomes available because another attendee cancels, the next person on the waitlist should automatically receive a confirmed ticket.
The challenges are keeping ticket ownership consistent during transfers, validating that the recipient is registered, preventing transfers of cancelled bookings, maintaining the correct waitlist order and ensuring that automatic promotion works correctly with the existing booking and event capacity systems.
The requirements do not clearly specify whether the waitlist should be managed at the event level or separately for each seat tier. They also do not explicitly state how the existing seat tier information should be handled when a ticket is transferred or when a waitlisted attendee is automatically promoted. I will preserve the existing booking and seat-tier information unless the existing implementation requires a different approach.

## Approach

*How will you model the data? What's your implementation strategy? Why this approach over alternatives?*

I will build both features by extending the existing booking and ticket-management flow rather than creating a separate system. I will preserve the existing booking, ticket, event, user and seat-tier information so that ticket transfer and waitlist functionality remain consistent with the current capacity and booking behavior.
For ticket transfer, I will treat the existing booking as the source of truth for ownership. I will validate that the current attendee owns a confirmed booking and that the recipient email belongs to a registered user before performing the transfer. I will update the booking ownership to the recipient immediately, while preserving the existing event, seat tier and ticket details. After the transfer, the original attendee should no longer see the booking, while the recipient should see it in their bookings and retain access to the ticket details and QR code. I will reject transfers when the recipient does not exist or when the booking has already been cancelled.
For the waitlist, I will maintain an ordered list of attendees associated with the sold out event. Each waitlist entry will contain the attendee, event, position/order information and an active status so that attendees can join, view their position and leave voluntarily. When a cancellation makes capacity available, I will select the next eligible active waitlist entry and create or update the corresponding booking so that the attendee receives a confirmed ticket. I will then remove or deactivate that waitlist entry and keep the remaining positions consistent.
My implementation strategy will be to first understand the existing booking, cancellation, capacity, user, and ticket flows, then add the transfer functionality and waitlist functionality at the appropriate points in those existing flows. I will validate the required conditions before changing ownership or promoting a waitlisted attendee. I will also verify each acceptance test manually and capture the required screenshots as evidence.
I prefer this approach over creating independent ticket transfer or waitlist systems because it minimizes duplication and keeps the new features aligned with the existing booking and capacity logic. It also reduces the risk of having different sources of truth for ticket ownership or event availability. Where the requirements do not specify whether waitlists are separated by seat tier, I will preserve the existing event and seat-tier behavior and use the current implementation to determine the appropriate integration point.

*How will you model the data? What's your implementation strategy? Why this approach over alternatives?*

## Risks & Assumptions
The risks I see are incorrect ticket ownership, duplicate ticket allocation and incorrect capacity when a transfer or waitlist promotion happens. For a transfer, I need to make sure that only a confirmed and non-cancelled booking can be transferred, that the recipient is a registered user and that the ownership changes correctly so the original attendee no longer has access to the ticket while the recipient receives the ticket and valid QR code.
For the waitlist, there is a risk of promoting the wrong attendee or allowing more tickets to be issued than the event capacity allows. I will use the existing booking, cancellation and capacity logic when promoting someone from the waitlist. I will also make sure that cancelled or inactive waitlist entries are not selected for promotion and that leaving the waitlist removes the attendee from future promotion.
I am assuming that the existing booking system provides the information needed to determine booking status, event capacity, seat tier, attendee ownership and ticket details. I am also assuming that the existing user system can be used to check whether the recipient's email belongs to a registered user.
The requirements do not clearly say whether the waitlist should be managed separately for each seat tier. Since the existing platform supports independent seat tiers and capacity, I will check the current implementation before deciding how waitlist entries should work with seat tiers. I will keep the existing behavior unless the code or requirements indicate otherwise.
I would ask the product manager whether waitlist positions should be shared across an entire event or maintained separately for each seat tier. I would also ask whether a transferred ticket should keep its existing seat tier and ticket information and whether there should be any restrictions on transferring tickets close to the event time. If these rules are not specified, I will follow the existing booking and ticket behavior rather than adding new business rules.

*What could go wrong? What assumptions are you making? What questions would you ask the product manager?*

## Implementation Sequence
I will first inspect the existing booking, ticket, user, cancellation, capacity and seat tier flows so I can integrate the new features without changing the existing behavior unnecessarily.
I will implement the ticket transfer first. I will start with the transfer form and recipient email validation, then add the checks for a confirmed and non cancelled booking and a registered recipient. After that, I will update the ticket ownership so the original attendee loses access and the recipient can see the ticket in their bookings. I will verify that the transferred ticket still has the required details and valid QR code for check in.
Next, I will implement the waitlist. I will add the ability to join a waitlist when an event is sold out, store the attendee's position, and allow the attendee to leave the waitlist. I will then connect waitlist promotion to the existing cancellation and capacity flow so that when a ticket becomes available, the next eligible person is automatically promoted and receives a confirmed ticket.
After the backend behavior is working, I will add or update the attendee facing UI for the transfer and waitlist features. Finally, I will run the acceptance tests from the requirements in order, fix any issues I find, and capture the required screenshots for the submission folder.

*What order will you work in? What do you tackle first and why?*
I will first review the existing booking, ticket, user, cancellation, capacity and seat tier flows so I understand how the current system works and where the new features should fit.
I will tackle ticket transfer first because it has a direct flow around validating the existing booking, validating the recipient and changing ticket ownership. Once that flow is working, I will move to the event waitlist because the waitlist depends more closely on the existing booking, cancellation and capacity behaviour.
For the waitlist, I will implement joining, viewing the position, leaving the waitlist and then automatic promotion when a ticket becomes available. After both features are implemented, I will connect and verify the attendee facing flows.
Finally, I will run the acceptance tests in the order provided in the requirements, fix any issues I find and capture the required screenshots for the submission.
I chose this order because it lets me understand and preserve the existing system first, establish the ticket ownership flow before adding waitlist promotion and then verify the complete solution against the requirements.
