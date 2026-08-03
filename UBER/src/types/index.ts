export type Role = "customer" | "rider";

export type VehicleType = "bike" | "auto" | "cabEconomy" | "cabPremium";

export type RideStatus =
  | "SEARCHING_FOR_RIDER"
  | "START"
  | "ARRIVED"
  | "COMPLETED"
  | "CANCELLED";

export interface Profile {
  id: string;
  role: Role;
  phone: string | null;
  full_name: string;
  avatar_url: string | null;
  vehicle_type: VehicleType | null;
  vehicle_plate: string | null;
  rating: number;
  total_rides: number;
  total_earnings: number;
  created_at: string;
  updated_at: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PlaceResult {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

export interface Ride {
  id: string;
  vehicle: VehicleType;
  status: RideStatus;
  fare: number;
  distance_km: number;
  duration_min: number;
  pickup_address: string;
  drop_address: string;
  pickup_geog: string;
  drop_geog: string;
  customer_id: string;
  rider_id: string | null;
  otp: string;
  created_at: string;
  accepted_at: string | null;
  started_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
}

export interface RideWithParties extends Ride {
  customer?: Pick<Profile, "id" | "full_name" | "phone" | "avatar_url" | "rating">;
  rider?: Pick<Profile, "id" | "full_name" | "phone" | "avatar_url" | "rating" | "vehicle_type" | "vehicle_plate">;
}

export interface RiderLocation {
  rider_id: string;
  position: string;
  heading: number | null;
  on_duty: boolean;
  updated_at: string;
}

export interface RiderLocationDecoded extends Omit<RiderLocation, "position"> {
  lat: number;
  lng: number;
  distanceKm?: number;
  profile?: Pick<Profile, "full_name" | "vehicle_type" | "vehicle_plate" | "rating">;
}

export interface RideEvent {
  id: string;
  ride_id: string;
  status: string;
  actor_id: string | null;
  note: string | null;
  created_at: string;
}

export const VEHICLE_OPTIONS: {
  type: VehicleType;
  label: string;
  baseFare: number;
  perKm: number;
  perMin: number;
  capacity: string;
  eta: string;
  icon: string;
  speedKmh: number;
}[] = [
  { type: "bike", label: "Bike", baseFare: 50, perKm: 12, perMin: 2, capacity: "1 seat", eta: "2 min", icon: "bike", speedKmh: 28 },
  { type: "auto", label: "Auto", baseFare: 80, perKm: 22, perMin: 3, capacity: "3 seats", eta: "4 min", icon: "auto", speedKmh: 22 },
  { type: "cabEconomy", label: "Cab Economy", baseFare: 120, perKm: 28, perMin: 4, capacity: "4 seats", eta: "5 min", icon: "cabEconomy", speedKmh: 26 },
  { type: "cabPremium", label: "Cab Premium", baseFare: 200, perKm: 42, perMin: 6, capacity: "4 seats", eta: "7 min", icon: "cabPremium", speedKmh: 30 },
];

export interface ChatMessage {
  id: string;
  ride_id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export type CallSignalType = "offer" | "answer" | "ice" | "end" | "reject";

export interface CallSignal {
  id: string;
  ride_id: string;
  caller_id: string;
  callee_id: string;
  type: CallSignalType;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export const DEFAULT_CENTER: LatLng = { lat: 24.8607, lng: 67.0011 };
export const DEFAULT_CITY = "Karachi";
export const SEARCH_RADIUS_KM = 200;
export const NEARBY_RADIUS_KM = 200;
