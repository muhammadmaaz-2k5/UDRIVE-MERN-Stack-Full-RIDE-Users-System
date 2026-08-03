import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { UDriveMap } from "@/components/map/UDriveMap";
import { PlaceSearch } from "@/components/ui/PlaceSearch";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import type {
  LatLng,
  PlaceResult,
  VehicleType,
  Ride,
  RideWithParties,
} from "@/types";
import { VEHICLE_OPTIONS, NEARBY_RADIUS_KM, SEARCH_RADIUS_KM } from "@/types";
import {
  calculateFare,
  estimateDurationMin,
  haversineKm,
  formatINR,
  formatDistance,
  formatDuration,
  reverseGeocode,
  makeGeogPoint,
  decodeGeogPoint,
} from "@/lib/geo";
import { fetchRoute } from "@/lib/routing";
import { useNearbyRiders } from "@/hooks/useNearbyRiders";
import { useRideTracking } from "@/hooks/useRideTracking";
import {
  Bike,
  Truck,
  Car,
  Navigation,
  Crosshair,
  MapPin,
  Clock,
  Star,
  Phone,
  Shield,
  X,
  Check,
  Loader2,
  History,
  Home,
  Sparkles,
  Route as RouteIcon,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { CommunicationBar } from "@/components/ui/CommunicationBar";

type Stage = "booking" | "searching" | "tracking" | "history";

const vehicleIcons: Record<VehicleType, typeof Bike> = {
  bike: Bike,
  auto: Truck,
  cabEconomy: Car,
  cabPremium: Car,
};

export function CustomerScreen() {
  const { profile } = useAuth();
  const [stage, setStage] = useState<Stage>("booking");
  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [drop, setDrop] = useState<LatLng | null>(null);
  const [pickupAddr, setPickupAddr] = useState("");
  const [dropAddr, setDropAddr] = useState("");
  const [vehicle, setVehicle] = useState<VehicleType>("bike");
  const [center, setCenter] = useState<LatLng | null>(null);
  const [route, setRoute] = useState<LatLng[] | null>(null);
  const [routeInfo, setRouteInfo] = useState<{
    distanceKm: number;
    durationMin: number;
  } | null>(null);
  const [locating, setLocating] = useState(false);
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const [searchAttempts, setSearchAttempts] = useState(0);
  const [history, setHistory] = useState<RideWithParties[]>([]);
  const [panelOpen, setPanelOpen] = useState(true);

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCenter(p);
          setPickup(p);
          const addr = await reverseGeocode(p);
          setPickupAddr(addr);
          setLocating(false);
        },
        () => {
          setCenter(null);
          setLocating(false);
        },
        { enableHighAccuracy: true, timeout: 8000 },
      );
    }
  }, []);

  const { riders, loading: ridersLoading } = useNearbyRiders(
    center,
    NEARBY_RADIUS_KM,
  );

  const { ride, riderPos, loading: rideLoading } = useRideTracking(activeRideId);

  // Fetch route when both points set
  useEffect(() => {
    if (!pickup || !drop) {
      setRoute(null);
      setRouteInfo(null);
      return;
    }
    let cancelled = false;
    fetchRoute(pickup, drop).then((r) => {
      if (cancelled || !r) return;
      setRoute(r.coords);
      setRouteInfo({ distanceKm: r.distanceKm, durationMin: r.durationMin });
    });
    return () => {
      cancelled = true;
    };
  }, [pickup, drop]);

  // Auto-detect ride acceptance — move to tracking when a rider is assigned
  useEffect(() => {
    if (ride && ride.rider_id && ride.status !== "CANCELLED") {
      if (stage === "searching") setStage("tracking");
    }
    if (ride && ride.status === "COMPLETED") {
      setStage("booking");
      setPickup(null);
      setDrop(null);
      setRoute(null);
      setActiveRideId(null);
      toast("success", "Ride completed! See you again soon.");
    }
  }, [ride?.status, ride?.rider_id, stage]);

  // Simulate the search-for-rider retry loop (mirrors the 60km/10s/20x backend)
  useEffect(() => {
    if (stage !== "searching" || !activeRideId) return;
    const interval = setInterval(() => {
      setSearchAttempts((a) => a + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, [stage, activeRideId]);

  const distance = pickup && drop ? haversineKm(pickup, drop) : 0;
  const routeDistance = routeInfo?.distanceKm ?? distance;
  const duration = routeInfo?.durationMin ?? estimateDurationMin(routeDistance, vehicle);
  const fare = calculateFare(vehicle, routeDistance, duration);

  const handleBookRide = async () => {
    if (!pickup || !drop) {
      toast("error", "Set pickup and drop locations");
      return;
    }
    if (routeDistance < 0.3) {
      toast("error", "Drop is too close to pickup");
      return;
    }

    const { data, error } = await supabase
      .from("rides")
      .insert({
        vehicle,
        status: "SEARCHING_FOR_RIDER",
        fare,
        distance_km: Math.round(routeDistance * 100) / 100,
        duration_min: duration,
        pickup_address: pickupAddr || `${pickup.lat.toFixed(5)}, ${pickup.lng.toFixed(5)}`,
        drop_address: dropAddr || `${drop.lat.toFixed(5)}, ${drop.lng.toFixed(5)}`,
        pickup_geog: makeGeogPoint(pickup),
        drop_geog: makeGeogPoint(drop),
      })
      .select()
      .single();

    if (error || !data) {
      toast("error", "Could not book ride. Please try again.");
      return;
    }

    // Log event
    await supabase.from("ride_events").insert({
      ride_id: (data as Ride).id,
      status: "SEARCHING_FOR_RIDER",
      actor_id: profile?.id,
      note: "Ride created by customer",
    });

    setActiveRideId((data as Ride).id);
    setSearchAttempts(0);
    setStage("searching");
    toast("info", `Searching for riders within ${SEARCH_RADIUS_KM}km...`);
  };

  const handleCancelRide = async () => {
    if (!activeRideId) return;
    const { error } = await supabase
      .from("rides")
      .update({ status: "CANCELLED", cancelled_at: new Date().toISOString() })
      .eq("id", activeRideId);
    if (error) {
      toast("error", "Could not cancel ride");
      return;
    }
    await supabase.from("ride_events").insert({
      ride_id: activeRideId,
      status: "CANCELLED",
      actor_id: profile?.id,
      note: "Cancelled by customer",
    });
    setActiveRideId(null);
    setStage("booking");
    toast("info", "Ride cancelled");
  };

  const loadHistory = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("rides")
      .select(
        "*, rider:profiles!rides_rider_id_fkey(id, full_name, phone, avatar_url, rating, vehicle_type, vehicle_plate)",
      )
      .eq("customer_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory((data as RideWithParties[]) ?? []);
  };

  useEffect(() => {
    if (stage === "history") loadHistory();
  }, [stage]);

  const recenter = () => {
    if (navigator.geolocation) {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCenter(p);
          setLocating(false);
        },
        () => setLocating(false),
      );
    }
  };

  // ==================== SEARCHING STAGE ====================
  if (stage === "searching" && activeRideId) {
    return (
      <SearchingView
        pickup={pickup}
        drop={drop}
        attempts={searchAttempts}
        riders={riders}
        onCancel={handleCancelRide}
        center={center}
      />
    );
  }

  // ==================== TRACKING STAGE ====================
  if (stage === "tracking" && activeRideId) {
    return (
      <TrackingView
        ride={ride}
        riderPos={riderPos}
        loading={rideLoading}
        onCancel={handleCancelRide}
        center={center}
        myId={profile?.id ?? null}
      />
    );
  }

  // ==================== HISTORY STAGE ====================
  if (stage === "history") {
    return (
      <HistoryView
        history={history}
        onBack={() => setStage("booking")}
        loading={false}
      />
    );
  }

  // ==================== BOOKING STAGE ====================
  return (
    <div className="relative h-screen w-full">
      {/* Map */}
      <div className="absolute inset-0">
        <UDriveMap
          center={center ?? undefined}
          pickup={pickup}
          drop={drop}
          riders={riders}
          showRadius
          radiusKm={NEARBY_RADIUS_KM}
          route={route}
          riderMeta={Object.fromEntries(
            riders.map((r) => [
              r.rider_id,
              {
                vehicle: r.profile?.vehicle_type ?? "bike",
                name: r.profile?.full_name ?? "Rider",
              },
            ]),
          )}
        />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-[500] p-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="flex-1 bg-white rounded-2xl shadow-floating px-4 py-2.5 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-udrive-700" />
            <span className="text-sm font-semibold text-slate-900">
              {riders.length} riders nearby
            </span>
            {ridersLoading && (
              <Loader2 className="w-4 h-4 text-slate-400 animate-spin ml-auto" />
            )}
            <span className="text-xs text-slate-400 ml-auto">
              within {NEARBY_RADIUS_KM}km
            </span>
          </div>
          <button
            onClick={recenter}
            className="bg-white rounded-2xl shadow-floating w-11 h-11 flex items-center justify-center text-udrive-700 hover:bg-udrive-50 transition"
            title="Recenter"
          >
            {locating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Crosshair className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={() => setStage("history")}
            className="bg-white rounded-2xl shadow-floating w-11 h-11 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition"
            title="Ride history"
          >
            <History className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Bottom booking panel — hide/show toggle */}
      <div className="absolute bottom-0 left-0 right-0 z-[500]">
        <div className="max-w-2xl mx-auto bg-white rounded-t-3xl shadow-floating udrive-slide-up overflow-hidden transition-all duration-300 ease-out">
          {/* Drag handle / toggle header */}
          <button
            onClick={() => setPanelOpen((v) => !v)}
            className="w-full pt-3 pb-1 flex flex-col items-center gap-1.5 hover:bg-slate-50/60 transition"
          >
            <div className="w-10 h-1.5 bg-slate-200 rounded-full" />
            <div className="flex items-center gap-1 text-xs font-semibold text-slate-500">
              {panelOpen ? (
                <>
                  <ChevronDown className="w-4 h-4" /> Hide panel
                </>
              ) : (
                <>
                  <ChevronUp className="w-4 h-4" /> Show details
                </>
              )}
            </div>
          </button>

          {/* Collapsed summary — quick glance when panel hidden */}
          {!panelOpen && (
            <div className="px-5 pb-4 udrive-fade-in">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-udrive-50 flex items-center justify-center shrink-0">
                    {(() => {
                      const Icon = vehicleIcons[vehicle];
                      return <Icon className="w-5 h-5 text-udrive-700" />;
                    })()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900">
                      {VEHICLE_OPTIONS.find((o) => o.type === vehicle)?.label}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {pickup && drop
                        ? `${formatDistance(routeDistance)} · ${formatDuration(duration)}`
                        : "Set pickup & drop"}
                    </div>
                  </div>
                </div>
                {pickup && drop && (
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-udrive-700">
                      {formatINR(fare)}
                    </div>
                  </div>
                )}
              </div>
              {pickup && drop && (
                <Button
                  fullWidth
                  size="md"
                  onClick={handleBookRide}
                  icon={<Navigation className="w-4 h-4" />}
                  className="mt-3"
                >
                  Book now · {formatINR(fare)}
                </Button>
              )}
            </div>
          )}

          {/* Expanded panel */}
          {panelOpen && (
            <div className="px-5 pb-5 max-h-[60vh] overflow-y-auto udrive-fade-in">
              {/* Location inputs */}
              <div className="space-y-2.5 mb-4">
                <PlaceSearch
                  label="Pickup"
                  placeholder="Pickup location"
                  value={pickupAddr}
                  near={center ?? undefined}
                  iconColor="teal"
                  onSelect={(p: PlaceResult) => {
                    setPickup({ lat: p.lat, lng: p.lng });
                    setPickupAddr(p.label);
                  }}
                  onClear={() => setPickup(null)}
                />
                <PlaceSearch
                  label="Drop"
                  placeholder="Where to?"
                  value={dropAddr}
                  near={pickup ?? center ?? undefined}
                  iconColor="red"
                  onSelect={(p: PlaceResult) => {
                    setDrop({ lat: p.lat, lng: p.lng });
                    setDropAddr(p.label);
                  }}
                  onClear={() => setDrop(null)}
                />
              </div>

              {/* Route summary */}
              {pickup && drop && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 mb-4 udrive-fade-in">
                  <RouteIcon className="w-5 h-5 text-udrive-700 shrink-0" />
                  <div className="flex-1 text-sm">
                    <span className="font-semibold text-slate-900">
                      {formatDistance(routeDistance)}
                    </span>
                    <span className="text-slate-400 mx-1.5">·</span>
                    <span className="text-slate-600">
                      {formatDuration(duration)} ETA
                    </span>
                  </div>
                  {route && (
                    <span className="text-xs text-udrive-600 font-medium">
                      Routed
                    </span>
                  )}
                </div>
              )}

              {/* Vehicle selection */}
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Choose a ride
              </p>
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                {VEHICLE_OPTIONS.map((opt) => {
                  const Icon = vehicleIcons[opt.type];
                  const optFare = calculateFare(
                    opt.type,
                    routeDistance,
                    duration,
                  );
                  const selected = vehicle === opt.type;
                  return (
                    <button
                      key={opt.type}
                      onClick={() => setVehicle(opt.type)}
                      className={`relative p-3.5 rounded-2xl border-2 text-left transition ${
                        selected
                          ? "border-udrive-500 bg-udrive-50"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      {selected && (
                        <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-udrive-600 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <Icon
                        className={`w-7 h-7 mb-2 ${
                          opt.type === "cabPremium" ? "text-udrive-800" : "text-slate-700"
                        }`}
                      />
                      <div className="text-sm font-bold text-slate-900">
                        {opt.label}
                      </div>
                      <div className="text-xs text-slate-500 mb-1.5">
                        {opt.capacity} · {opt.eta} away
                      </div>
                      {pickup && drop ? (
                        <div className="text-base font-bold text-udrive-700">
                          {formatINR(optFare)}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400">
                          Base {formatINR(opt.baseFare)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Book button */}
              <Button
                fullWidth
                size="lg"
                onClick={handleBookRide}
                disabled={!pickup || !drop}
                icon={<Navigation className="w-5 h-5" />}
              >
                {pickup && drop
                  ? `Book ${VEHICLE_OPTIONS.find((o) => o.type === vehicle)?.label} · ${formatINR(fare)}`
                  : "Set pickup & drop to book"}
              </Button>
              <p className="text-center text-xs text-slate-400 mt-2.5">
                Fare includes base + distance + time. OTP shared after booking.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SEARCHING VIEW
// ============================================================
function SearchingView({
  pickup,
  drop,
  attempts,
  riders,
  onCancel,
  center,
}: {
  pickup: LatLng | null;
  drop: LatLng | null;
  attempts: number;
  riders: any[];
  onCancel: () => void;
  center: LatLng | null;
}) {
  const maxAttempts = 20;
  return (
    <div className="relative h-screen w-full">
      <div className="absolute inset-0">
        <UDriveMap
          center={center ?? undefined}
          pickup={pickup}
          drop={drop}
          riders={riders}
          showRadius
          radiusKm={NEARBY_RADIUS_KM}
          showSearchRadius
          searchRadiusKm={SEARCH_RADIUS_KM}
          searchCenter={pickup}
          riderMeta={Object.fromEntries(
            riders.map((r) => [
              r.rider_id,
              {
                vehicle: r.profile?.vehicle_type ?? "bike",
                name: r.profile?.full_name ?? "Rider",
              },
            ]),
          )}
        />
      </div>

      <div className="absolute top-0 left-0 right-0 z-[500] p-4">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-floating px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent-100 flex items-center justify-center shrink-0">
            <Loader2 className="w-5 h-5 text-accent-600 animate-spin" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-slate-900">
              Searching for riders...
            </div>
            <div className="text-xs text-slate-500">
              Broadcast to {riders.length} riders within {SEARCH_RADIUS_KM}km ·
              attempt {Math.min(attempts + 1, maxAttempts)}/{maxAttempts}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-[500]">
        <div className="max-w-2xl mx-auto bg-white rounded-t-3xl shadow-floating p-5 udrive-slide-up">
          <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Search radius
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {SEARCH_RADIUS_KM} km
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Riders notified
              </div>
              <div className="text-2xl font-bold text-udrive-700">
                {riders.length}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-udrive-500 to-udrive-700 transition-all duration-1000"
              style={{
                width: `${Math.min((attempts / maxAttempts) * 100, 100)}%`,
              }}
            />
          </div>

          <Button
            fullWidth
            variant="danger"
            size="lg"
            onClick={onCancel}
            icon={<X className="w-5 h-5" />}
          >
            Cancel search
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TRACKING VIEW
// ============================================================
function TrackingView({
  ride,
  riderPos,
  loading,
  onCancel,
  center,
  myId,
}: {
  ride: RideWithParties | null;
  riderPos: LatLng | null;
  loading: boolean;
  onCancel: () => void;
  center: LatLng | null;
  myId: string | null;
}) {
  if (loading || !ride) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-udrive-700 animate-spin" />
      </div>
    );
  }

  const pickup = decodeGeogPoint(ride.pickup_geog);
  const drop = decodeGeogPoint(ride.drop_geog);
  const rider = ride.rider;
  const riders = riderPos && ride.rider_id
    ? [{
        rider_id: ride.rider_id,
        lat: riderPos.lat,
        lng: riderPos.lng,
        heading: null,
        on_duty: true,
        updated_at: new Date().toISOString(),
        distanceKm: 0,
      }]
    : [];

  const statusInfo = getStatusInfo(ride.status);

  return (
    <div className="relative h-screen w-full">
      <div className="absolute inset-0">
        <UDriveMap
          center={center ?? pickup ?? undefined}
          pickup={pickup}
          drop={drop}
          riders={riders}
          route={pickup && drop ? [pickup, drop] : null}
          riderMeta={
            ride.rider_id
              ? {
                  [ride.rider_id]: {
                    vehicle: rider?.vehicle_type ?? ride.vehicle,
                    name: rider?.full_name ?? "Your rider",
                  },
                }
              : {}
          }
          trackedRiderId={ride.rider_id}
          fitTo={[pickup, drop, riderPos].filter(Boolean) as LatLng[]}
        />
      </div>

      {/* Status banner */}
      <div className="absolute top-0 left-0 right-0 z-[500] p-4">
        <div className="max-w-2xl mx-auto">
          <div
            className={`rounded-2xl shadow-floating px-4 py-3 flex items-center gap-3 ${statusInfo.bg}`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${statusInfo.iconBg}`}
            >
              {statusInfo.icon}
            </div>
            <div className="flex-1">
              <div className={`text-sm font-bold ${statusInfo.text}`}>
                {statusInfo.title}
              </div>
              <div className={`text-xs ${statusInfo.subText}`}>
                {statusInfo.subtitle}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom ride panel */}
      <div className="absolute bottom-0 left-0 right-0 z-[500]">
        <div className="max-w-2xl mx-auto bg-white rounded-t-3xl shadow-floating udrive-slide-up overflow-hidden">
          <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-2" />
          <div className="px-5 pb-5">
            {/* Rider info */}
            {rider && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 mb-3">
                <div className="w-12 h-12 rounded-full bg-udrive-100 text-udrive-700 flex items-center justify-center font-bold text-lg shrink-0">
                  {rider.full_name?.charAt(0) ?? "R"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 truncate">
                    {rider.full_name}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 fill-accent-400 text-accent-400" />
                    {rider.rating?.toFixed(1) ?? "4.8"}
                    {rider.vehicle_plate && (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px]">
                        {rider.vehicle_plate}
                      </span>
                    )}
                  </div>
                </div>
                <a
                  href={`tel:${rider.phone ?? ""}`}
                  className="w-10 h-10 rounded-full bg-udrive-600 text-white flex items-center justify-center hover:bg-udrive-700 transition"
                >
                  <Phone className="w-4 h-4" />
                </a>
              </div>
            )}

            {/* Chat + Call controls */}
            {ride.rider_id && rider && myId && (
              <CommunicationBar
                rideId={ride.id}
                myId={myId}
                otherId={ride.rider_id}
                otherName={rider.full_name ?? "Rider"}
                active
              />
            )}

            {/* OTP display */}
            {ride.status === "SEARCHING_FOR_RIDER" && (
              <div className="p-3 rounded-xl bg-accent-50 border border-accent-200 mb-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-accent-800 mb-2">
                  <Shield className="w-4 h-4" /> Your ride OTP
                </div>
                <div className="flex gap-2 justify-center">
                  {ride.otp.split("").map((d, i) => (
                    <div key={i} className="udrive-otp-box">
                      {d}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-accent-700 mt-2 text-center">
                  Share this with your rider to start the trip
                </p>
              </div>
            )}

            {/* Trip details */}
            <div className="space-y-2 mb-3">
              <div className="flex items-start gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-udrive-600 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-400">Pickup</div>
                  <div className="text-sm text-slate-700 truncate">
                    {ride.pickup_address}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-400">Drop</div>
                  <div className="text-sm text-slate-700 truncate">
                    {ride.drop_address}
                  </div>
                </div>
              </div>
            </div>

            {/* Fare + distance */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 mb-3">
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <div className="text-xs text-slate-400">Distance</div>
                  <div className="font-semibold text-slate-900">
                    {formatDistance(Number(ride.distance_km))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Duration</div>
                  <div className="font-semibold text-slate-900">
                    {formatDuration(ride.duration_min)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Fare</div>
                <div className="text-xl font-bold text-udrive-700">
                  {formatINR(Number(ride.fare))}
                </div>
              </div>
            </div>

            {ride.status !== "COMPLETED" && ride.status !== "CANCELLED" && (
              <Button
                fullWidth
                variant="outline"
                onClick={onCancel}
                icon={<X className="w-4 h-4" />}
              >
                Cancel ride
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getStatusInfo(status: string) {
  switch (status) {
    case "SEARCHING_FOR_RIDER":
      return {
        title: "Finding your rider",
        subtitle: "Notifying nearby riders...",
        bg: "bg-accent-50",
        iconBg: "bg-accent-100 text-accent-600",
        text: "text-accent-900",
        subText: "text-accent-700",
        icon: <Loader2 className="w-5 h-5 animate-spin" />,
      };
    case "START":
      return {
        title: "Ride on the way",
        subtitle: "Your rider is heading to pickup",
        bg: "bg-blue-50",
        iconBg: "bg-blue-100 text-blue-600",
        text: "text-blue-900",
        subText: "text-blue-700",
        icon: <Navigation className="w-5 h-5" />,
      };
    case "ARRIVED":
      return {
        title: "Rider has arrived",
        subtitle: "Meet at the pickup location",
        bg: "bg-udrive-50",
        iconBg: "bg-udrive-100 text-udrive-700",
        text: "text-udrive-900",
        subText: "text-udrive-700",
        icon: <MapPin className="w-5 h-5" />,
      };
    case "COMPLETED":
      return {
        title: "Ride completed",
        subtitle: "Thanks for riding with UDRIVE",
        bg: "bg-green-50",
        iconBg: "bg-green-100 text-green-600",
        text: "text-green-900",
        subText: "text-green-700",
        icon: <Check className="w-5 h-5" />,
      };
    default:
      return {
        title: "Processing",
        subtitle: "",
        bg: "bg-slate-50",
        iconBg: "bg-slate-100 text-slate-600",
        text: "text-slate-900",
        subText: "text-slate-600",
        icon: <Loader2 className="w-5 h-5 animate-spin" />,
      };
  }
}

// ============================================================
// HISTORY VIEW
// ============================================================
function HistoryView({
  history,
  onBack,
  loading,
}: {
  history: RideWithParties[];
  onBack: () => void;
  loading: boolean;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
          >
            <Home className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Your rides</h1>
            <p className="text-xs text-slate-500">
              {history.length} trip{history.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-5">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-udrive-700 animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <History className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-bold text-slate-700 mb-1">No rides yet</h3>
            <p className="text-sm text-slate-500">
              Book your first ride to see it here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((r) => (
              <RideHistoryCard key={r.id} ride={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RideHistoryCard({ ride }: { ride: RideWithParties }) {
  const statusColors: Record<string, string> = {
    COMPLETED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
    SEARCHING_FOR_RIDER: "bg-accent-100 text-accent-700",
    START: "bg-blue-100 text-blue-700",
    ARRIVED: "bg-udrive-100 text-udrive-700",
  };
  const statusLabel: Record<string, string> = {
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    SEARCHING_FOR_RIDER: "Searching",
    START: "In progress",
    ARRIVED: "Arrived",
  };
  return (
    <div className="bg-white rounded-2xl p-4 shadow-card">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColors[ride.status] ?? "bg-slate-100 text-slate-600"}`}
          >
            {statusLabel[ride.status] ?? ride.status}
          </span>
          <span className="text-xs text-slate-400">
            {new Date(ride.created_at).toLocaleDateString("en-PK", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="text-lg font-bold text-udrive-700">
          {formatINR(Number(ride.fare))}
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full bg-udrive-600" />
          <span className="text-slate-600 truncate">{ride.pickup_address}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-slate-600 truncate">{ride.drop_address}</span>
        </div>
      </div>
      {ride.rider && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
          <Star className="w-3.5 h-3.5 fill-accent-400 text-accent-400" />
          {ride.rider.full_name} · {ride.vehicle}
        </div>
      )}
    </div>
  );
}
