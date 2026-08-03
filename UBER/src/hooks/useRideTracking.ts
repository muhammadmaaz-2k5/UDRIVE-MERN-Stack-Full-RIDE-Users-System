import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { LatLng, RideWithParties } from "@/types";
import { decodeGeogPoint } from "@/lib/geo";

/**
 * Subscribes to a single ride row + its rider's live location. Returns the
 * latest ride data (with customer/rider profile joins) and the rider's current
 * position so the customer can track them on the map.
 */
export function useRideTracking(rideId: string | null) {
  const [ride, setRide] = useState<RideWithParties | null>(null);
  const [riderPos, setRiderPos] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(true);
  const rideRef = useRef(ride);
  rideRef.current = ride;

  useEffect(() => {
    if (!rideId) {
      setRide(null);
      setRiderPos(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadRide() {
      const { data, error } = await supabase
        .from("rides")
        .select(
          "*, customer:profiles!rides_customer_id_fkey(id, full_name, phone, avatar_url, rating), rider:profiles!rides_rider_id_fkey(id, full_name, phone, avatar_url, rating, vehicle_type, vehicle_plate)",
        )
        .eq("id", rideId)
        .maybeSingle();

      if (cancelled || error || !data) {
        setLoading(false);
        return;
      }
      setRide(data as RideWithParties);
      setLoading(false);
    }

    loadRide();

    const channel = supabase
      .channel(`ride_${rideId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rides", filter: `id=eq.${rideId}` },
        (payload) => {
          setRide((prev) =>
            prev ? { ...prev, ...(payload.new as any) } : (payload.new as any),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ride_events", filter: `ride_id=eq.${rideId}` },
        () => loadRide(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [rideId]);

  // Track the assigned rider's live position
  useEffect(() => {
    const riderId = ride?.rider_id;
    if (!riderId) {
      setRiderPos(null);
      return;
    }

    async function loadPos() {
      const { data } = await supabase
        .from("rider_locations")
        .select("position::text, heading, on_duty, updated_at")
        .eq("rider_id", riderId!)
        .maybeSingle();
      if (data) {
        const pt = decodeGeogPoint((data as any).position);
        if (pt) setRiderPos(pt);
      }
    }

    loadPos();

    const channel = supabase
      .channel(`rider_pos_${riderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rider_locations",
          filter: `rider_id=eq.${riderId}`,
        },
        (payload) => {
          const pt = decodeGeogPoint((payload.new as any).position);
          if (pt) setRiderPos(pt);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ride?.rider_id]);

  return { ride, riderPos, loading };
}
