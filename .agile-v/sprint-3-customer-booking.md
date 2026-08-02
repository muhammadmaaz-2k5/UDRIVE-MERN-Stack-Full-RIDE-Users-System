# Sprint 3: Customer App - Ride Booking Flow

## Objective
Build the core ride booking experience for Customers, integrating maps and WebSocket communication.

## Tasks
1. **Customer Dashboard & Map**
   - Create `src/pages/CustomerDashboard.tsx`.
   - Integrate Google Maps (or chosen map provider) spanning the full screen.
   - Add a floating UI panel for ride interactions.

2. **Booking Interface ("Where to?")**
   - Build a searchable input for Pickup and Drop-off locations.
   - Display route on the map and calculate estimated distance/fare.
   - Vehicle selection UI (Bike, Auto, Cab Economy, Cab Premium).

3. **Ride Creation API**
   - Implement `POST /api/v1/rides` integration.
   - Handle loading states while searching for riders.

4. **Socket.IO Integration (Customer)**
   - Initialize socket connection in `src/services/socket.ts` using JWT for auth.
   - Emit `subscribeToZone` with customer's current location.
   - Emit `searchrider` upon ride creation.
   - Listen for `nearbyriders` to display available cars on the map.
   - Listen for `rideAccepted` to transition to the active ride view.

## Definition of Done
- Customer can select pickup/drop-off points and view the route on a map.
- Ride request can be successfully submitted.
- Socket connection is established and emits search events correctly.
