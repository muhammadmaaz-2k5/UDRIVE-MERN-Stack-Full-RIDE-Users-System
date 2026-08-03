import type { LatLng, PlaceResult, VehicleType } from "@/types";
import { VEHICLE_OPTIONS } from "@/types";

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function estimateDurationMin(distanceKm: number, vehicle: VehicleType): number {
  const opt = VEHICLE_OPTIONS.find((o) => o.type === vehicle);
  const speed = opt?.speedKmh ?? 25;
  return Math.max(3, Math.round((distanceKm / speed) * 60));
}

export function calculateFare(
  vehicle: VehicleType,
  distanceKm: number,
  durationMin: number,
): number {
  const opt = VEHICLE_OPTIONS.find((o) => o.type === vehicle);
  if (!opt) return 0;
  const fare = opt.baseFare + opt.perKm * distanceKm + opt.perMin * durationMin;
  return Math.round(fare);
}

export function formatINR(amount: number): string {
  return "Rs " + Math.round(amount).toLocaleString("en-PK");
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-PK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function decodeGeogPoint(geog: any): LatLng | null {
  if (!geog) return null;
  // Handle GeoJSON format (default in newer PostgREST versions)
  if (typeof geog === "object" && geog.type === "Point" && Array.isArray(geog.coordinates)) {
    return { lng: geog.coordinates[0], lat: geog.coordinates[1] };
  }
  // Handle WKT string format
  if (typeof geog === "string") {
    const match = geog.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (match) {
      return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
    }
  }
  return null;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const PHOTON_URL = "https://photon.komoot.io/api";

export async function searchPlaces(
  query: string,
  near?: LatLng,
): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  // Photon (Komoot) first — fast autocomplete, great for partial typing
  try {
    const params = new URLSearchParams({ q, limit: "6" });
    if (near) {
      params.set("lon", String(near.lng));
      params.set("lat", String(near.lat));
    }
    const res = await fetch(`${PHOTON_URL}?${params}`, {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      const features: any[] = data.features ?? [];
      const out: PlaceResult[] = features.slice(0, 6).map((f) => {
        const p = f.properties ?? {};
        const [lng, lat] = f.geometry?.coordinates ?? [];
        const label = [
          p.name,
          p.street,
          p.housenumber,
          p.city,
          p.state,
          p.country,
        ]
          .filter(Boolean)
          .join(", ");
        return {
          id: String(f.properties?.osm_id ?? `${lat},${lng}`),
          label: label || p.name || "Unknown place",
          lat,
          lng,
        };
      });
      if (out.length) return out;
    }
  } catch {
    // fall through to Nominatim
  }

  // Fallback: Nominatim
  try {
    const params = new URLSearchParams({
      q,
      format: "json",
      limit: "6",
      addressdetails: "1",
    });
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      return (data as any[]).slice(0, 6).map((d) => ({
        id: String(d.place_id),
        label: d.display_name,
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
      }));
    }
  } catch {
    // ignore
  }
  return [];
}

export async function reverseGeocode(point: LatLng): Promise<string> {
  try {
    const params = new URLSearchParams({
      lat: String(point.lat),
      lon: String(point.lng),
      format: "json",
      zoom: "18",
      addressdetails: "1",
    });
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params}`,
      { headers: { Accept: "application/json" } },
    );
    if (res.ok) {
      const data = await res.json();
      if (data.display_name) return data.display_name;
    }
  } catch {
    // ignore
  }
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

export function makeGeogPoint(point: LatLng): string {
  // Supabase/PostGIS accepts "POINT(lng lat)" for geography cast
  return `POINT(${point.lng} ${point.lat})`;
}

export function bearing(a: LatLng, b: LatLng): number {
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}
