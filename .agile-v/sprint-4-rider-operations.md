# Sprint 4: Rider (Driver) App - Operations

## Objective
Enable Riders to go on duty, receive ride offers, and manage active rides.

## Tasks
1. **Rider Dashboard**
   - Create `src/pages/RiderDashboard.tsx`.
   - Implement map view centered on rider's current location.

2. **Duty Status Management**
   - Add a prominent "Go On Duty" / "Go Off Duty" toggle.
   - Emit `goOnDuty` / `goOffDuty` socket events with current coordinates.
   - Update `useAuthStore` or `useRideStore` with duty status.

3. **Ride Offer Notifications**
   - Listen for `rideOffer` socket events.
   - Display a premium, attention-grabbing modal or slide-up panel with ride details (pickup, drop-off, fare, distance).
   - Add "Accept" and "Decline" actions with visual countdowns.

4. **Accept Ride Flow**
   - Implement `PATCH /api/v1/rides/:id/accept` API integration upon accepting.
   - Start broadcasting location continuously using `updateLocation` socket event.
   - Transition dashboard to "Active Ride" view, showing route to customer.

## Definition of Done
- Rider can toggle duty status successfully.
- Ride offers are received in real-time and displayed prominently.
- Rider can accept an offer, updating the backend and initiating location broadcasting.
