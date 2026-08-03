import type { LatLng } from "@/types";

const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

export async function fetchRoute(
  pickup: LatLng,
  drop: LatLng,
): Promise<{ coords: LatLng[]; distanceKm: number; durationMin: number } | null> {
  try {
    const res = await fetch(
      `${OSRM_URL}/${pickup.lng},${pickup.lat};${drop.lng},${drop.lat}?overview=full&geometries=geojson`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route?.geometry?.coordinates) return null;
    const coords: LatLng[] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => ({ lat, lng }),
    );
    return {
      coords,
      distanceKm: route.distance / 1000,
      durationMin: Math.round(route.duration / 60),
    };
  } catch {
    return null;
  }
}
