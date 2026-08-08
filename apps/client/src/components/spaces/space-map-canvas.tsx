"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMapEvents,
} from "react-leaflet";

// The Leaflet canvas itself, loaded only in the browser — see `space-map.tsx`,
// which is the half that decides that.
//
// Two things here are Leaflet-specific chores rather than decisions:
//
// THE MARKER ICON. Leaflet builds its default marker's URL by looking at the path
// of its own stylesheet, which is a technique that predates bundlers and produces
// a 404 under every one of them — the classic symptom being a map that works with
// an invisible pin. So the icon is built explicitly from the bundled asset URLs.
//
// THE CLICK HANDLER. `useMapEvents` has to be a CHILD of MapContainer, because it
// reads the map instance from context. It renders nothing; it exists to be inside.

type SpaceMapCanvasProps = {
  latitude: number | null;
  longitude: number | null;
  // Read-only on the staff side: somebody looking at a customer's site should not
  // be able to move their building by clicking.
  editable: boolean;
  onPick: (latitude: number, longitude: number) => void;
};

type PickerProps = {
  onPick: (latitude: number, longitude: number) => void;
};

// Riyadh. A map has to open somewhere, and an unpinned site in this business is
// far more likely to be in the Kingdom than at 0,0 — which is in the Atlantic and
// reads as a bug.
const FALLBACK: [number, number] = [24.7136, 46.6753];

const markerIcon = L.icon({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const Picker = ({ onPick }: PickerProps) => {
  useMapEvents({
    click: (event) => {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
};

export const SpaceMapCanvas = ({
  latitude,
  longitude,
  editable,
  onPick,
}: SpaceMapCanvasProps) => {
  const pinned = latitude !== null && longitude !== null;
  const centre: [number, number] = pinned ? [latitude, longitude] : FALLBACK;

  // No mount-delay dance here. Leaflet measures its container once, on mount, and
  // renders a single grey tile if that container has no height yet — but this whole
  // module is loaded with `ssr: false`, so it first renders after hydration, and
  // the height comes from a class rather than from a measured parent. The
  // placeholder while the chunk loads is the dynamic import's own `loading`.
  return (
    <MapContainer
      center={centre}
      zoom={pinned ? 16 : 11}
      scrollWheelZoom={false}
      className="h-64 w-full rounded-[14px]"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {pinned && <Marker position={[latitude, longitude]} icon={markerIcon} />}
      {editable && <Picker onPick={onPick} />}
    </MapContainer>
  );
};
