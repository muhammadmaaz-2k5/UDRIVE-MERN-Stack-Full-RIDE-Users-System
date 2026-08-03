import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { UDriveMap } from "@/components/map/UDriveMap";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import type { LatLng, Ride, RideWithParties, RiderLocationDecoded, Profile } from "@/types";
import { NEARBY_RADIUS_KM, SEARCH_RADIUS_KM } from "@/types";
import {
  haversineKm,
  formatINR,
  formatDistance,
  formatDuration,
  formatTimeAgo,
  makeGeogPoint,
  decodeGeogPoint,
} from "@/lib/geo";
import { fetchRoute } from "@/lib/routing";
import {
  Power,
  Navigation,
  MapPin,
  Star,
  Phone,
  Shield,
  X,
  Check,
  Loader2,
  TrendingUp,
  Clock,
  Route as RouteIcon,
  Wallet,
  Bike,
  Truck,
  Car,
} from "lucide-react";
import { CommunicationBar } from "@/components/ui/CommunicationBar";

type Stage = "dashboard" | "incoming" | "active" | "history";

interface IncomingRide extends RideWithParties {
  _pickupPt?: LatLng;
  _distance?: number;
}

export function RiderScreen() {
  const { profile } = useAuth();
  const [stage, setStage] = useState<Stage>("dashboard");
  const [onDuty, setOnDuty] = useState(false);
  const [pos, setPos] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [incomingRides, setIncomingRides] = useState<IncomingRide[]>([]);
  const [activeRide, setActiveRide] = useState<RideWithParties | null>(null);
  const [route, setRoute] = useState<LatLng[] | null>(null);
  const [history, setHistory] = useState<RideWithParties[]>([]);
  const [stats, setStats] = useState({ today: 0, week: 0, total: 0 });
  const [panelOpen, setPanelOpen] = useState(true);
  const watchId = useRef<number | null>(null);

  // Start geolocation tracking
  useEffect(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const pt = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPos(pt);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );
    return () => {
      if (watchId.current !== null)
        navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  // Update rider location in DB when on duty and position changes
  useEffect(() => {
    if (!profile || !pos) return;
    if (!onDuty) return;

    const heading = 0;
    supabase
      .from("rider_locations")
      .upsert({
        rider_id: profile.id,
        position: makeGeogPoint(pos),
        heading,
        on_duty: true,
        updated_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.warn("location upsert failed", error.message);
      });
  }, [pos?.lat, pos?.lng, onDuty, profile?.id]);

  // Toggle duty
  const toggleDuty = async () => {
    if (!profile || !pos) {
      toast("error", "Waiting for your location...");
      return;
    }
    const newDuty = !onDuty;
    setOnDuty(newDuty);

    const { error } = await supabase.from("rider_locations").upsert({
      rider_id: profile.id,
      position: makeGeogPoint(pos),
      heading: 0,
      on_duty: newDuty,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      toast("error", "Could not update duty status");
      setOnDuty(!newDuty);
      return;
    }
    toast("success", newDuty ? "You're now on duty" : "You're off duty");
  };

  // Listen for incoming ride requests (SEARCHING_FOR_RIDER within 60km)
  useEffect(() => {
    if (!onDuty || !profile || !pos) {
      setIncomingRides([]);
      return;
    }

    let cancelled = false;

    async function fetchIncoming() {
      if (!profile || !pos || cancelled) return;
      // Query rides searching for a rider within search radius
      const { data, error } = await supabase
        .from("rides")
        .select(
          "*, customer:profiles!rides_customer_id_fkey(id, full_name, phone, avatar_url, rating)",
        )
        .eq("status", "SEARCHING_FOR_RIDER")
        .is("rider_id", null)
        .order("created_at", { ascending: true })
        .limit(10);

      console.log("Rider fetchIncoming fetched:", { data, error });
      if (error || !data || cancelled) return;

      // Filter by distance to pickup
      const relevant = (data as RideWithParties[])
        .map((r): IncomingRide | null => {
          const pickup = decodeGeogPoint(r.pickup_geog);
          if (!pickup) return null;
          const dist = haversineKm(pos, pickup);
          if (dist > SEARCH_RADIUS_KM) return null;
          return { ...r, _pickupPt: pickup, _distance: dist };
        })
        .filter((x): x is IncomingRide => x !== null)
        .sort((a, b) => (a._distance ?? 0) - (b._distance ?? 0));

      console.log("Rider fetchIncoming relevant:", relevant);
      setIncomingRides(relevant);
    }

    fetchIncoming();

    const channel = supabase
      .channel("rider_incoming")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rides" },
        () => fetchIncoming(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rides" },
        () => fetchIncoming(),
      )
      .subscribe();

    const interval = setInterval(fetchIncoming, 5000);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [onDuty, profile?.id, pos?.lat, pos?.lng]);

  // Auto-switch to incoming view when rides available (and not in active ride)
  useEffect(() => {
    if (incomingRides.length > 0 && stage === "dashboard" && !activeRide) {
      setStage("incoming");
    }
    if (incomingRides.length === 0 && stage === "incoming" && !activeRide) {
      setStage("dashboard");
    }
  }, [incomingRides.length, stage, activeRide]);

  // Load active ride (assigned to this rider)
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    async function loadActive() {
      if (!profile || cancelled) return;
      const { data } = await supabase
        .from("rides")
        .select(
          "*, customer:profiles!rides_customer_id_fkey(id, full_name, phone, avatar_url, rating)",
        )
        .eq("rider_id", profile.id)
        .in("status", ["START", "ARRIVED"])
        .maybeSingle();

      if (cancelled) return;
      if (data) {
        setActiveRide(data as RideWithParties);
        setStage("active");
      } else {
        setActiveRide(null);
        if (stage === "active") setStage("dashboard");
      }
    }

    loadActive();

    const channel = supabase
      .channel("rider_active")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rides", filter: `rider_id=eq.${profile.id}` },
        () => loadActive(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  // Compute route for active ride
  useEffect(() => {
    if (!activeRide || !pos) {
      setRoute(null);
      return;
    }
    const pickup = decodeGeogPoint(activeRide.pickup_geog);
    const drop = decodeGeogPoint(activeRide.drop_geog);
    const target = activeRide.status === "START" ? pickup : drop;
    if (!target) return;
    fetchRoute(pos, target).then((r) => {
      if (r) setRoute(r.coords);
    });
  }, [activeRide?.id, activeRide?.status, pos?.lat, pos?.lng]);

  // Load stats + history
  async function loadStats() {
    if (!profile) return;
    const { data } = await supabase
      .from("rides")
      .select("fare, status, created_at")
      .eq("rider_id", profile.id)
      .eq("status", "COMPLETED");
    if (!data) return;
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    const today = data
      .filter((r) => new Date(r.created_at) > dayAgo)
      .reduce((s, r) => s + Number(r.fare), 0);
    const week = data
      .filter((r) => new Date(r.created_at) > weekAgo)
      .reduce((s, r) => s + Number(r.fare), 0);
    const total = data.reduce((s, r) => s + Number(r.fare), 0);
    setStats({ today, week, total });
  }

  async function loadHistory() {
    if (!profile) return;
    const { data } = await supabase
      .from("rides")
      .select(
        "*, customer:profiles!rides_customer_id_fkey(id, full_name, phone, avatar_url, rating)",
      )
      .eq("rider_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory((data as RideWithParties[]) ?? []);
  }

  useEffect(() => {
    loadStats();
  }, [profile?.id, stage]);

  const acceptRide = async (ride: IncomingRide) => {
    if (!profile) return;
    const { error } = await supabase
      .from("rides")
      .update({
        rider_id: profile.id,
        status: "START",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", ride.id)
      .eq("status", "SEARCHING_FOR_RIDER");

    if (error) {
      toast("error", "Could not accept ride — it may be taken");
      return;
    }

    await supabase.from("ride_events").insert({
      ride_id: ride.id,
      status: "START",
      actor_id: profile.id,
      note: "Ride accepted by rider",
    });

    setActiveRide({ ...ride, rider_id: profile.id, status: "START" });
    setIncomingRides([]);
    setStage("active");
    toast("success", "Ride accepted! Head to pickup.");
  };

  const advanceStatus = async (newStatus: "ARRIVED" | "COMPLETED") => {
    if (!activeRide || !profile) return;
    const ts: Record<string, string> = {
      ARRIVED: "arrived_at",
      COMPLETED: "completed_at",
    };
    const update: any = { status: newStatus };
    update[ts[newStatus]] = new Date().toISOString();

    const { error } = await supabase
      .from("rides")
      .update(update)
      .eq("id", activeRide.id);

    if (error) {
      toast("error", "Could not update ride status");
      return;
    }

    await supabase.from("ride_events").insert({
      ride_id: activeRide.id,
      status: newStatus,
      actor_id: profile.id,
      note: newStatus === "ARRIVED" ? "Rider arrived at pickup" : "Ride completed",
    });

    if (newStatus === "COMPLETED") {
      // Update rider stats
      await supabase
        .from("profiles")
        .update({
          total_rides: (profile.total_rides ?? 0) + 1,
          total_earnings: Number(profile.total_earnings ?? 0) + Number(activeRide.fare),
        })
        .eq("id", profile.id);

      setActiveRide(null);
      setRoute(null);
      setStage("dashboard");
      toast("success", `Ride completed! Earned ${formatINR(Number(activeRide.fare))}`);
      loadStats();
    } else {
      setActiveRide({ ...activeRide, status: newStatus });
      toast("info", "Marked as arrived at pickup");
    }
  };

  // ==================== ACTIVE RIDE ====================
  if (stage === "active" && activeRide) {
    return (
      <ActiveRideView
        ride={activeRide}
        pos={pos}
        route={route}
        onArrived={() => advanceStatus("ARRIVED")}
        onComplete={() => advanceStatus("COMPLETED")}
        myId={profile?.id ?? null}
      />
    );
  }

  // ==================== HISTORY ====================
  if (stage === "history") {
    return (
      <RiderHistoryView
        history={history}
        onBack={() => setStage("dashboard")}
        onLoaded={loadHistory}
      />
    );
  }

  // ==================== DASHBOARD / INCOMING ====================
  return (
    <div className="relative h-screen w-full">
      <div className="absolute inset-0">
        <UDriveMap
          center={pos ?? undefined}
          customerPos={onDuty ? pos : null}
          riders={
            onDuty && pos
              ? [
                  {
                    rider_id: profile?.id ?? "me",
                    lat: pos.lat,
                    lng: pos.lng,
                    heading: null,
                    on_duty: true,
                    updated_at: new Date().toISOString(),
                    distanceKm: 0,
                  },
                ]
              : []
          }
          showRadius={onDuty}
          radiusKm={NEARBY_RADIUS_KM}
          route={null}
          riderMeta={
            profile
              ? {
                  [profile.id]: {
                    vehicle: profile.vehicle_type ?? "bike",
                    name: profile.full_name,
                  },
                }
              : {}
          }
        />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-[500] p-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div
            className={`flex-1 rounded-2xl shadow-floating px-4 py-2.5 flex items-center gap-2 ${
              onDuty ? "bg-white" : "bg-white/90"
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                onDuty ? "bg-green-500 animate-pulse" : "bg-slate-400"
              }`}
            />
            <span className="text-sm font-semibold text-slate-900">
              {onDuty ? "On duty" : "Off duty"}
            </span>
            {locating && (
              <Loader2 className="w-4 h-4 text-slate-400 animate-spin ml-auto" />
            )}
            <span className="text-xs text-slate-400 ml-auto">
              {incomingRides.length} request
              {incomingRides.length !== 1 ? "s" : ""}
            </span>
          </div>
          <button
            onClick={() => setStage("history")}
            className="bg-white rounded-2xl shadow-floating w-11 h-11 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition"
          >
            <TrendingUp className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Incoming ride offers */}
      {stage === "incoming" && incomingRides.length > 0 && (
        <div className="absolute top-20 left-0 right-0 z-[500] px-4">
          <div className="max-w-2xl mx-auto space-y-2 max-h-[40vh] overflow-y-auto">
            {incomingRides.slice(0, 3).map((r) => (
              <IncomingRideCard
                key={r.id}
                ride={r}
                distance={r._distance}
                onAccept={() => acceptRide(r)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bottom dashboard panel */}
      <div className="absolute bottom-0 left-0 right-0 z-[500]">
        <div className="max-w-2xl mx-auto bg-white rounded-t-3xl shadow-floating udrive-slide-up overflow-hidden transition-all duration-300 ease-out">
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
          
          {panelOpen && (
            <div className="px-5 pb-5 udrive-fade-in mt-2">
            {/* Earnings */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <StatBox label="Today" value={formatINR(stats.today)} icon={<Wallet className="w-4 h-4" />} />
              <StatBox label="This week" value={formatINR(stats.week)} icon={<TrendingUp className="w-4 h-4" />} />
              <StatBox label="All time" value={formatINR(stats.total)} icon={<Star className="w-4 h-4" />} />
            </div>

            {/* Profile strip */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 mb-4">
              <div className="w-12 h-12 rounded-full bg-udrive-100 text-udrive-700 flex items-center justify-center font-bold text-lg shrink-0">
                {profile?.full_name?.charAt(0) ?? "R"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-900 truncate">
                  {profile?.full_name}
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 fill-accent-400 text-accent-400" />
                  {profile?.rating?.toFixed(1) ?? "4.8"} · {profile?.total_rides ?? 0} rides
                  {profile?.vehicle_plate && (
                    <span className="ml-1 px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px]">
                      {profile.vehicle_plate}
                    </span>
                  )}
                </div>
              </div>
              {profile?.vehicle_type && (
                <div className="text-2xl">
                  {profile.vehicle_type === "bike" ? "🏍️" : profile.vehicle_type === "auto" ? "🛺" : "🚗"}
                </div>
              )}
            </div>

            {/* Duty toggle */}
            <button
              onClick={toggleDuty}
              disabled={locating}
              className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-bold text-base transition active:scale-[0.98] disabled:opacity-50 ${
                onDuty
                  ? "bg-red-50 text-red-600 hover:bg-red-100 border-2 border-red-200"
                  : "bg-udrive-700 text-white hover:bg-udrive-800 shadow-md"
              }`}
            >
              {locating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Power className="w-5 h-5" />
              )}
              {onDuty ? "Go off duty" : "Go on duty"}
            </button>
            <p className="text-center text-xs text-slate-400 mt-2.5">
              {onDuty
                ? `Receiving ride offers within ${SEARCH_RADIUS_KM}km of your location`
                : "Go on duty to start receiving ride requests"}
            </p>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// INCOMING RIDE CARD
// ============================================================
function IncomingRideCard({
  ride,
  distance,
  onAccept,
}: {
  ride: IncomingRide;
  distance?: number;
  onAccept: () => void;
}) {
  const [accepting, setAccepting] = useState(false);
  return (
    <div className="bg-white rounded-2xl shadow-floating p-4 udrive-fade-in border-l-4 border-l-accent-500">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-xs font-semibold text-accent-600 uppercase tracking-wide">
            New ride request
          </div>
          <div className="text-lg font-bold text-slate-900 mt-0.5">
            {formatINR(Number(ride.fare))}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">Pickup dist</div>
          <div className="text-sm font-bold text-udrive-700">
            {distance ? formatDistance(distance) : "—"}
          </div>
        </div>
      </div>

      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-udrive-600 shrink-0" />
          <span className="text-slate-600 truncate">{ride.pickup_address}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Navigation className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-slate-600 truncate">{ride.drop_address}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
        <span className="flex items-center gap-1">
          <RouteIcon className="w-3.5 h-3.5" /> {formatDistance(Number(ride.distance_km))}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" /> {formatDuration(ride.duration_min)}
        </span>
        <span className="capitalize">{ride.vehicle}</span>
      </div>

      <div className="flex gap-2">
        <Button
          variant="primary"
          fullWidth
          loading={accepting}
          onClick={() => {
            setAccepting(true);
            onAccept();
          }}
          icon={<Check className="w-4 h-4" />}
        >
          Accept
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// ACTIVE RIDE VIEW
// ============================================================
function ActiveRideView({
  ride,
  pos,
  route,
  onArrived,
  onComplete,
  myId,
}: {
  ride: RideWithParties;
  pos: LatLng | null;
  route: LatLng[] | null;
  onArrived: () => void;
  onComplete: () => void;
  myId: string | null;
}) {
  const pickup = decodeGeogPoint(ride.pickup_geog);
  const drop = decodeGeogPoint(ride.drop_geog);
  const customer = ride.customer;
  const target = ride.status === "START" ? pickup : drop;
  const distToTarget =
    pos && target ? haversineKm(pos, target) : null;

  return (
    <div className="relative h-screen w-full">
      <div className="absolute inset-0">
        <UDriveMap
          center={pos ?? pickup ?? undefined}
          pickup={pickup}
          drop={drop}
          route={route}
          riders={
            pos
              ? [
                  {
                    rider_id: "me",
                    lat: pos.lat,
                    lng: pos.lng,
                    heading: null,
                    on_duty: true,
                    updated_at: new Date().toISOString(),
                    distanceKm: 0,
                  },
                ]
              : []
          }
          trackedRiderId="me"
          fitTo={[pickup, drop, pos].filter(Boolean) as LatLng[]}
          riderMeta={{ me: { vehicle: ride.vehicle, name: "You" } }}
        />
      </div>

      {/* Status banner */}
      <div className="absolute top-0 left-0 right-0 z-[500] p-4">
        <div className="max-w-2xl mx-auto">
          <div
            className={`rounded-2xl shadow-floating px-4 py-3 flex items-center gap-3 ${
              ride.status === "START" ? "bg-blue-50" : "bg-udrive-50"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                ride.status === "START"
                  ? "bg-blue-100 text-blue-600"
                  : "bg-udrive-100 text-udrive-700"
              }`}
            >
              {ride.status === "START" ? (
                <Navigation className="w-5 h-5" />
              ) : (
                <MapPin className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1">
              <div
                className={`text-sm font-bold ${
                  ride.status === "START" ? "text-blue-900" : "text-udrive-900"
                }`}
              >
                {ride.status === "START"
                  ? "Heading to pickup"
                  : "Arrived — trip in progress"}
              </div>
              <div
                className={`text-xs ${
                  ride.status === "START" ? "text-blue-700" : "text-udrive-700"
                }`}
              >
                {distToTarget != null
                  ? `${formatDistance(distToTarget)} to ${ride.status === "START" ? "pickup" : "drop"}`
                  : "Calculating..."}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom panel */}
      <div className="absolute bottom-0 left-0 right-0 z-[500]">
        <div className="max-w-2xl mx-auto bg-white rounded-t-3xl shadow-floating udrive-slide-up overflow-hidden">
          <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-2" />
          <div className="px-5 pb-5">
            {/* Customer info */}
            {customer && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 mb-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg shrink-0">
                  {customer.full_name?.charAt(0) ?? "C"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 truncate">
                    {customer.full_name}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 fill-accent-400 text-accent-400" />
                    {customer.rating?.toFixed(1) ?? "4.8"}
                  </div>
                </div>
                <a
                  href={`tel:${customer.phone ?? ""}`}
                  className="w-10 h-10 rounded-full bg-udrive-600 text-white flex items-center justify-center hover:bg-udrive-700 transition"
                >
                  <Phone className="w-4 h-4" />
                </a>
              </div>
            )}

            {/* Chat + Call controls */}
            {ride.customer_id && customer && myId && (
              <CommunicationBar
                rideId={ride.id}
                myId={myId}
                otherId={ride.customer_id}
                otherName={customer.full_name ?? "Customer"}
                active
              />
            )}

            {/* OTP (when heading to pickup) */}
            {ride.status === "START" && (
              <div className="p-3 rounded-xl bg-accent-50 border border-accent-200 mb-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-accent-800 mb-2">
                  <Shield className="w-4 h-4" /> Ride OTP — verify with customer
                </div>
                <div className="flex gap-2 justify-center">
                  {ride.otp.split("").map((d, i) => (
                    <div key={i} className="udrive-otp-box">
                      {d}
                    </div>
                  ))}
                </div>
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
                <div className="text-xs text-slate-400">You earn</div>
                <div className="text-xl font-bold text-udrive-700">
                  {formatINR(Number(ride.fare))}
                </div>
              </div>
            </div>

            {ride.status === "START" ? (
              <Button
                fullWidth
                size="lg"
                onClick={onArrived}
                icon={<MapPin className="w-5 h-5" />}
              >
                Mark arrived at pickup
              </Button>
            ) : (
              <Button
                fullWidth
                size="lg"
                variant="secondary"
                onClick={onComplete}
                icon={<Check className="w-5 h-5" />}
              >
                Complete ride
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// RIDER HISTORY
// ============================================================
function RiderHistoryView({
  history,
  onBack,
  onLoaded,
}: {
  history: RideWithParties[];
  onBack: () => void;
  onLoaded: () => void;
}) {
  useEffect(() => {
    onLoaded();
  }, []);
  const total = history
    .filter((r) => r.status === "COMPLETED")
    .reduce((s, r) => s + Number(r.fare), 0);
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
          >
            <Power className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Ride history</h1>
            <p className="text-xs text-slate-500">
              {history.length} rides · {formatINR(total)} earned
            </p>
          </div>
        </div>
      </header>
      <div className="max-w-2xl mx-auto p-5">
        {history.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-bold text-slate-700 mb-1">No rides yet</h3>
            <p className="text-sm text-slate-500">
              Go on duty and accept your first ride
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl p-4 shadow-card">
                <div className="flex items-start justify-between mb-2">
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      r.status === "COMPLETED"
                        ? "bg-green-100 text-green-700"
                        : r.status === "CANCELLED"
                          ? "bg-red-100 text-red-700"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {r.status === "COMPLETED"
                      ? "Completed"
                      : r.status === "CANCELLED"
                        ? "Cancelled"
                        : r.status}
                  </span>
                  <div className="text-lg font-bold text-udrive-700">
                    {formatINR(Number(r.fare))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-udrive-600" />
                    <span className="text-slate-600 truncate">
                      {r.pickup_address}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-slate-600 truncate">
                      {r.drop_address}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  {formatTimeAgo(r.created_at)} · {r.customer?.full_name ?? "Customer"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <div className="flex items-center justify-center text-udrive-600 mb-1">
        {icon}
      </div>
      <div className="text-sm font-bold text-slate-900">{value}</div>
      <div className="text-[10px] text-slate-400 uppercase tracking-wide">
        {label}
      </div>
    </div>
  );
}
