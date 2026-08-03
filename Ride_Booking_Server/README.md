# UDRIVE Backend Documentation

This document provides a comprehensive overview of the UDRIVE backend architecture, REST API endpoints, WebSocket events, and database schema.

## 🏗 Architecture Overview

The UDRIVE backend is built with **Node.js** and **Express.js**, leveraging **MongoDB** via Mongoose for data persistence. It incorporates **Socket.IO** for real-time bidirectional communication essential for a ride-hailing application (e.g., location tracking, ride matching).

- **Authentication:** JWT-based access and refresh tokens.
- **Real-time Engine:** Socket.IO handles driver location broadcasts, ride requests, and status updates.
- **Geospatial Logic:** `geolib` is used to calculate distances and match nearby riders based on live coordinates.
- **Error Handling:** Centralized through `express-async-errors` and custom middleware.

---

## 💾 Database Schema (MongoDB / Mongoose)

### 1. User Model (`models/User.js`)
Handles both customers and riders.

| Field   | Type   | Description                                       |
| :------ | :----- | :------------------------------------------------ |
| `role`  | String | Enum: `["customer", "rider"]`                     |
| `phone` | String | Unique phone number used for authentication.      |

*Methods:*
- `createAccessToken()`: Generates a short-lived JWT.
- `createRefreshToken()`: Generates a long-lived JWT.

### 2. Ride Model (`models/Ride.js`)
Manages ride states and lifecycle.

| Field      | Type     | Description                                                                 |
| :--------- | :------- | :-------------------------------------------------------------------------- |
| `vehicle`  | String   | Enum: `["bike", "auto", "cabEconomy", "cabPremium"]`                        |
| `distance` | Number   | Calculated ride distance.                                                   |
| `fare`     | Number   | Calculated price of the ride.                                               |
| `pickup`   | Object   | Contains `address` (String), `latitude` (Number), `longitude` (Number)      |
| `drop`     | Object   | Contains `address` (String), `latitude` (Number), `longitude` (Number)      |
| `customer` | ObjectId | Reference to the User (customer).                                           |
| `rider`    | ObjectId | Reference to the User (driver/rider). Defaults to `null`.                   |
| `status`   | String   | `["SEARCHING_FOR_RIDER", "START", "ARRIVED", "COMPLETED"]`                  |
| `otp`      | String   | 4-digit code generated for ride verification.                               |

---

## 🔌 REST API Endpoints

> [!NOTE]
> All `/ride/*` endpoints are protected by the `authMiddleware` which requires a valid `Authorization: Bearer <token>` header.

### Authentication (`/auth`)

#### `POST /auth/signin`
Unified endpoint for both login and registration. If the phone number exists, logs the user in; otherwise, creates a new account.
- **Body:** `{ "phone": "+1234567890", "role": "customer" }`
- **Response (200/201):** `{ message, user, access_token, refresh_token }`

#### `POST /auth/refresh-token`
Generates a new pair of tokens using a valid refresh token.
- **Body:** `{ "refresh_token": "..." }`
- **Response (200):** `{ access_token, refresh_token }`

### Ride Management (`/ride`)

#### `POST /ride/create`
Creates a new ride request and calculates distance and fare.
- **Body:** `{ "vehicle", "pickup": { address, latitude, longitude }, "drop": { address, latitude, longitude } }`
- **Response (201):** `{ message, ride }`

#### `PATCH /ride/accept/:rideId`
Called by a rider to accept a pending ride. Emits real-time updates to the customer.
- **Response (200):** `{ message, ride }`

#### `PATCH /ride/update/:rideId`
Updates the progress of an active ride (e.g., driver arrived, ride completed).
- **Body:** `{ "status": "ARRIVED" }`
- **Response (200):** `{ message, ride }`

#### `GET /ride/rides`
Fetches ride history for the authenticated user (whether customer or rider). Supports optional `?status=` query filter.
- **Response (200):** `{ count, rides: [...] }`

---

## 📡 Real-time Engine (Socket.IO)

The WebSocket connection requires authentication via `access_token` in the handshake headers.

### Rider Events (Drivers)
- `goOnDuty (coords)`: Marks the driver as active and joins the `onDuty` pool.
- `goOffDuty ()`: Removes the driver from the active pool.
- `updateLocation (coords)`: Broadcasts the driver's live location to the system and subscribed customers.

### Customer Events (Passengers)
- `subscribeToZone (coords)`: Informs the server of the customer's location to receive `nearbyriders` updates.
- `searchrider (rideId)`: Triggers a search algorithm to broadcast a `rideOffer` to nearby drivers (within 60km radius). Retries every 10 seconds up to 20 times.
- `cancelRide ()`: Cancels an ongoing search or active ride, notifying assigned drivers.
- `subscribeToriderLocation (riderId)`: Subscribes the customer to a specific driver's live location updates (used after a ride is accepted).
- `subscribeRide (rideId)`: Joins a room specific to a ride to receive status updates.

### Server-Emitted Events
- `nearbyriders`: Sent to customers containing an array of available nearby drivers.
- `rideOffer`: Sent to eligible nearby drivers when a customer requests a ride.
- `riderLocationUpdate`: Sent to customers subscribed to a specific driver.
- `rideAccepted`: Sent to the customer when a driver accepts the ride.
- `rideUpdate`: Sent to room `ride_{rideId}` whenever ride status changes.
- `rideCanceled`: Broadcasted to relevant parties if a ride is aborted.
