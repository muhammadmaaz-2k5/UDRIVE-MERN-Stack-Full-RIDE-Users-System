import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { LatLng, RiderLocationDecoded, Profile } from "@/types";
import { haversineKm, decodeGeogPoint } from "@/lib/geo";

interface NearbyRider extends RiderLocationDecoded {
  distanceKm: number;
  profile?: Pick<Profile, "full_name" | "vehicle_type" | "vehicle_plate" | "rating">;
}

/**
 * Subscribes to all on-duty rider locations via Supabase realtime and computes
 * distance from the given center. Also does an initial fetch. Returns riders
 * sorted by distance.
 */
export function useNearbyRiders(center: LatLng | null, radiusKm = 6) {
  const [riders, setRiders] = useState<NearbyRider[]>([]);
  const [loading, setLoading] = useState(true);
  const centerRef = useRef(center);
  centerRef.current = center;

  const fetchRiders = useCallback(async () => {
    const { data, error } = await supabase
      .from("rider_locations")
      .select("rider_id, position::text, heading, on_duty, updated_at")
      .eq("on_duty", true);

    console.log("useNearbyRiders fetched:", { data, error });
    if (error || !data) {
      setLoading(false);
      return;
    }

    const c = centerRef.current;
    const decoded: NearbyRider[] = (data as any[])
      .map((r) => {
        const pt = decodeGeogPoint(r.position);
        if (!pt) return null;
        return {
          rider_id: r.rider_id,
          lat: pt.lat,
          lng: pt.lng,
          heading: r.heading,
          on_duty: r.on_duty,
          updated_at: r.updated_at,
          distanceKm: c ? haversineKm(c, pt) : 0,
        };
      })
      .filter((x): x is NearbyRider => x !== null)
      .filter((x) => !c || x.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    console.log("useNearbyRiders decoded:", decoded);
    setRiders(decoded);
    setLoading(false);
  }, [radiusKm]);

  useEffect(() => {
    fetchRiders();

    const channel = supabase
      .channel("nearby_riders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rider_locations" },
        () => fetchRiders(),
      )
      .subscribe();

    // Refresh every 15s as a fallback (positions may update)
    const interval = setInterval(fetchRiders, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchRiders]);

  // Load rider profiles for the decoded riders
  useEffect(() => {
    if (riders.length === 0) return;
    const ids = riders.map((r) => r.rider_id);
    supabase
      .from("profiles")
      .select("id, full_name, vehicle_type, vehicle_plate, rating")
      .in("id", ids)
      .then(({ data }) => {
        if (!data) return;
        const map = new Map(data.map((p: any) => [p.id, p]));
        setRiders((prev) =>
          prev.map((r) => ({ ...r, profile: map.get(r.rider_id) as any })),
        );
      });
  }, [riders.map((r) => r.rider_id).join(",")]);

  return { riders, loading, refetch: fetchRiders };
}
