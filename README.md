Ride Booking Backend

This is the backend server for a ride-booking application built with Node.js, Express, and Socket.IO.

## Features

- User Authentication (Sign Up, Login, Logout)
- Ride Management (Create, View, Track, Complete)
- Real-time Location Tracking via Socket.IO
- Proximity-based Driver Matching
- Geo-spatial queries (find nearby drivers)

## Tech Stack

- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **Socket.IO** - Real-time WebSocket communication
- **MongoDB** - Database
- **Mongoose** - ODM (Object Data Modeling)
- **jsonwebtoken** - JWT authentication
- **bcrypt.js** - Password hashing
- **geolib** - Geospatial calculations

## Project Structure

```
UDRIVE-MERN-Stack-Full-RIDE-Users-System/
├── config/            # Database and environment configuration
│   └── connect.js     # MongoDB connection
├── controllers/       # Request handlers
│   ├── auth.js        # Authentication controllers
│   └── ride.js        # Ride-related controllers
├── middleware/        # Express middleware
│   ├── authentication.js  # JWT authentication middleware
│   ├── error-handler.js   # Custom error handling
│   └── not-found.js       # 404 handler
├── models/            # Mongoose models
│   ├── Ride.js        # Ride schema and model
│   └── User.js        # User schema and model
├── routes/            # API route definitions
│   ├── auth.js        # Authentication routes
│   └── ride.js        # Ride routes
├── utils/             # Utility functions
│   └── mapUtils.js    # Geo-spatial utilities
├── app.js             # Express application entry point
├── package.json       # Project dependencies and scripts
└── .env-template copy  # Environment variable template
```

## Getting Started

### Prerequisites

- **Node.js** (v14 or higher)
- **MongoDB** (local or Atlas)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/muhammadmaaz-2k5/UDRIVE-MERN-Stack-Full-RIDE-Users-System.git
cd UDRIVE-MERN-Stack-Full-RIDE-Users-System
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory (copy from `.env-template`):

```bash
cp .env-template .env
```

4. Configure the environment variables in `.env`:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_LIFETIME=90d
```

### Run the Server

```bash
npm start
```

The server will start on port 3000 by default (or as specified in `PORT` environment variable).

## API Documentation

### Authentication

**Sign Up**
```bash
POST /api/v1/auth/register

Request:
{
  "name": "John Doe",
  "email": "[EMAIL_ADDRESS]",
  "password": "[PASSWORD]",
  "phone": "1234567890",
  "role": "customer"  // customer or driver
}

Response:
{
  "success": true,
  "user": {
    "_id": "...",
    "name": "John Doe",
    "email": "[EMAIL_ADDRESS]",
    "phone": "1234567890",
    "role": "customer"
  }
}
```

**Login**
```bash
POST /api/v1/auth/login

Request:
{
  "email": "[EMAIL_ADDRESS]",
  "password": "[PASSWORD]"
}

Response:
{
  "success": true,
  "user": {
    "_id": "...",
    "name": "John Doe",
    "email": "[EMAIL_ADDRESS]",
    "phone": "1234567890",
    "role": "customer"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Rides

**Create Ride**
```bash
POST /api/v1/rides

Request:
{
  "startLocation": {
    "type": "Point",
    "coordinates": [-74.0060, 40.7128]
  },
  "endLocation": {
    "type": "Point",
    "coordinates": [-73.9857, 40.7580]
  },
  "pickupAddress": "123 Main St",
  "dropoffAddress": "456 Broadway",
  "vehicleType": "sedan"
}

Response:
{
  "success": true,
  "ride": {
    "_id": "...",
    "customer": "...",
    "status": "requested",
    "createdAt": "..."
  }
}
```

**Get Current User's Rides**
```bash
GET /api/v1/rides/my-rides

Query Params:
- status: filter by status (e.g., ?status=requested)

Response:
{
  "success": true,
  "count": 2,
  "rides": [
    {
      "_id": "...",
      "customer": "...",
      "status": "requested",
      "createdAt": "..."
    }
  ]
}
```

**Get Nearby Drivers**
```bash
GET /api/v1/rides/nearby-drivers

Query Params:
- lat: latitude (required)
- lng: longitude (required)
- maxDistance: max distance in meters (default: 5000)
- limit: max number of drivers (default: 10)

Response:
{
  "success": true,
  "count": 5,
  "drivers": [
    {
      "_id": "...",
      "name": "Driver One",
      "phone": "1234567890",
      "distance": 1.234  // distance in km
    }
  ]
}
```

**Accept Ride (Driver)**
```bash
POST /api/v1/rides/:id/accept

Request:
{
  "vehicleId": "...",
  "vehicleType": "sedan",
  "vehicleName": "Toyota Camry"
}

Response:
{
  "success": true,
  "ride": {
    "_id": "...",
    "driver": "...",
    "status": "accepted",
    "vehicleId": "...",
    "vehicleType": "sedan",
    "vehicleName": "Toyota Camry"
  }
}
```

**Start Ride**
```bash
POST /api/v1/rides/:id/start

Request:
{
  "currentLocation": {
    "type": "Point",
    "coordinates": [-74.0060, 40.7128]
  }
}

Response:
{
  "success": true,
  "ride": {
    "_id": "...",
    "status": "ongoing",
    "startTime": "..."
  }
}
```

**Update Location (Driver)**
```bash
POST /api/v1/rides/:id/location

Request:
{
  "location": {
    "type": "Point",
    "coordinates": [-74.0060, 40.7128]
  }
}

Response:
{
  "success": true,
  "ride":
