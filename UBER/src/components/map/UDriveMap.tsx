import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { LatLng, RiderLocationDecoded } from "@/types";
import {
  DEFAULT_CENTER,
  NEARBY_RADIUS_KM,
  SEARCH_RADIUS_KM,
} from "@/types";
import { haversineKm } from "@/lib/geo";

// Fix default Leaflet icon paths (Vite bundle)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function makePinIcon(color: "teal" | "red" | "blue" | "amber", pulse = false) {
  const bg =
    color === "teal"
      ? "#0f766e"
      : color === "red"
        ? "#ef4444"
        : color === "blue"
          ? "#2563eb"
          : "#f59e0b";
  const iconClass = `udrive-pin udrive-pin-${
    color === "teal"
      ? "pickup"
      : color === "red"
        ? "drop"
        : color === "blue"
          ? "customer"
          : "rider"
  }`;
  return L.divIcon({
    className: "",
    html: `<div class="${iconClass}" style="background:${bg}">${
      pulse ? '<span class="udrive-rider-pulse"></span>' : ""
    }<span style="color:#fff;font-size:16px;font-weight:700">●</span></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -34],
  });
}

function makeVehicleIcon(vehicle: string, pulse = true) {
  const emoji =
    vehicle === "bike"
      ? "🏍️"
      : vehicle === "auto"
        ? "🛺"
        : vehicle === "cabPremium"
          ? "🚗"
          : "🚙";
  return L.divIcon({
    className: "",
    html: `<div class="udrive-rider-marker" style="position:relative;width:38px;height:38px;display:flex;align-items:center;justify-content:center">${
      pulse ? '<span class="udrive-rider-pulse"></span>' : ""
    }<div style="width:38px;height:38px;border-radius:50%;background:#f59e0b;border:2.5px solid #fff;box-shadow:0 4px 12px rgba(15,23,42,0.35);display:flex;align-items:center;justify-content:center;font-size:20px;z-index:1">${emoji}</div></div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -22],
  });
}

function makeLabelIcon(text: string, variant: "radius" | "search") {
  const cls = variant === "radius" ? "udrive-radius-label" : "udrive-search-label";
  return L.divIcon({
    className: "",
    html: `<div class="${cls}">${text}</div>`,
    iconSize: [120, 24],
    iconAnchor: [60, 12],
  });
}

function FitBounds({
  points,
  padding = 80,
}: {
  points: LatLng[];
  padding?: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [padding, padding], animate: true });
  }, [points, padding, map]);
  return null;
}

function ClickHandler({
  onClick,
}: {
  onClick: (p: LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      onClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function MapResizeObserver() {
  const map = useMap();
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

export interface UDriveMapProps {
  center?: LatLng;
  pickup?: LatLng | null;
  drop?: LatLng | null;
  customerPos?: LatLng | null;
  riders?: RiderLocationDecoded[];
  showRadius?: boolean;
  radiusKm?: number;
  showSearchRadius?: boolean;
  searchRadiusKm?: number;
  searchCenter?: LatLng | null;
  route?: LatLng[] | null;
  onMapClick?: (p: LatLng) => void;
  fitTo?: LatLng[] | null;
  zoom?: number;
  interactive?: boolean;
  className?: string;
  riderMeta?: Record<string, { vehicle: string; name: string }>;
  trackedRiderId?: string | null;
}

export function UDriveMap({
  center = DEFAULT_CENTER,
  pickup,
  drop,
  customerPos,
  riders = [],
  showRadius = false,
  radiusKm = NEARBY_RADIUS_KM,
  showSearchRadius = false,
  searchRadiusKm = SEARCH_RADIUS_KM,
  searchCenter,
  route,
  onMapClick,
  fitTo,
  zoom = 13,
  interactive = true,
  className,
  riderMeta = {},
  trackedRiderId,
}: UDriveMapProps) {
  const fitPoints = useMemo(() => {
    if (fitTo && fitTo.length) return fitTo;
    const pts: LatLng[] = [];
    if (pickup) pts.push(pickup);
    if (drop) pts.push(drop);
    if (customerPos) pts.push(customerPos);
    return pts;
  }, [fitTo, pickup, drop, customerPos]);

  const radiusCenter = customerPos ?? pickup ?? center;

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      zoomControl={interactive}
      dragging={interactive}
      doubleClickZoom={interactive}
      scrollWheelZoom={interactive}
      touchZoom={interactive}
      keyboard={interactive}
      className={className ?? "h-full w-full"}
      preferCanvas
    >
      <MapResizeObserver />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      {showRadius && radiusCenter && (
        <>
          <Circle
            center={[radiusCenter.lat, radiusCenter.lng]}
            radius={radiusKm * 1000}
            pathOptions={{
              color: "#0f766e",
              weight: 2,
              fillColor: "#14b8a6",
              fillOpacity: 0.08,
              dashArray: "6 6",
            }}
          />
          <Marker
            position={[radiusCenter.lat, radiusCenter.lng]}
            icon={makeLabelIcon(`${radiusKm} km radius`, "radius")}
            interactive={false}
          />
        </>
      )}

      {showSearchRadius && searchCenter && (
        <>
          <Circle
            center={[searchCenter.lat, searchCenter.lng]}
            radius={searchRadiusKm * 1000}
            pathOptions={{
              color: "#ef4444",
              weight: 1.5,
              fillColor: "#ef4444",
              fillOpacity: 0.04,
              dashArray: "4 8",
            }}
          />
          <Marker
            position={[searchCenter.lat, searchCenter.lng]}
            icon={makeLabelIcon(`${searchRadiusKm} km search area`, "search")}
            interactive={false}
          />
        </>
      )}

      {route && route.length > 1 && (
        <Polyline
          positions={route.map((p) => [p.lat, p.lng])}
          pathOptions={{ color: "#0f766e", weight: 5, opacity: 0.85 }}
        />
      )}

      {customerPos && (
        <Marker
          position={[customerPos.lat, customerPos.lng]}
          icon={makePinIcon("blue")}
        >
          <Popup>You are here</Popup>
        </Marker>
      )}

      {pickup && (
        <Marker position={[pickup.lat, pickup.lng]} icon={makePinIcon("teal")}>
          <Popup>Pickup</Popup>
        </Marker>
      )}

      {drop && (
        <Marker position={[drop.lat, drop.lng]} icon={makePinIcon("red")}>
          <Popup>Drop location</Popup>
        </Marker>
      )}

      {riders.map((r) => {
        const meta = riderMeta[r.rider_id];
        const isTracked = trackedRiderId === r.rider_id;
        return (
          <Marker
            key={r.rider_id}
            position={[r.lat, r.lng]}
            icon={makeVehicleIcon(meta?.vehicle ?? "bike", isTracked)}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{meta?.name ?? "Rider"}</div>
                <div className="text-slate-500 capitalize">
                  {meta?.vehicle ?? "vehicle"}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {onMapClick && <ClickHandler onClick={onMapClick} />}
      <FitBounds points={fitPoints} />
    </MapContainer>
  );
}

export { haversineKm };
