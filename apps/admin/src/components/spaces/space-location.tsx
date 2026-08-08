"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapPin } from "lucide-react";
import dynamic from "next/dynamic";

// Where a customer's site is, for whoever is dispatching an engineer to it.
//
// READ-ONLY, and that is the decision rather than an omission. The customer set
// this pin by pointing at their own building; a staff screen that let somebody drag
// it would let a person who has never been there overwrite the only account of
// where a site is that came from somebody who has.
//
// Leaflet reaches for `window` at import time, so the whole thing is pulled in
// with `ssr: false`. The default marker's icon URL is derived from its own
// stylesheet's path, which 404s under every bundler — hence the explicit icon.

type SpaceLocationProps = {
  name: string;
  latitude: number | null;
  longitude: number | null;
};

type CanvasProps = {
  latitude: number;
  longitude: number;
};

const markerIcon = L.icon({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});

const MapContainer = dynamic(
  () => import("react-leaflet").then((module) => module.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((module) => module.TileLayer),
  { ssr: false },
);
const Marker = dynamic(
  () => import("react-leaflet").then((module) => module.Marker),
  { ssr: false },
);

const Canvas = ({ latitude, longitude }: CanvasProps) => (
  // Leaflet measures its container once, on mount, and renders one grey tile if
  // that container has no height — but every piece of react-leaflet here is loaded
  // with `ssr: false`, so this first renders after hydration, and the height comes
  // from a class rather than from a measured parent.
  <MapContainer
    center={[latitude, longitude]}
    zoom={16}
    scrollWheelZoom={false}
    className="h-56 w-full rounded-card"
  >
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
    <Marker position={[latitude, longitude]} icon={markerIcon} />
  </MapContainer>
);

export const SpaceLocation = ({
  name,
  latitude,
  longitude,
}: SpaceLocationProps) => {
  if (latitude === null || longitude === null) {
    // Said plainly rather than shown as an empty map centred on nothing. "No pin"
    // is a fact worth reading; a map of the wrong place is not.
    return (
      <p className="rounded-card border border-dashed border-hairline px-4 py-6 text-center text-sm text-faint">
        {name} has no map pin. The customer sets it from their own site page.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-card border border-hairline">
        <Canvas latitude={latitude} longitude={longitude} />
      </div>
      <p className="inline-flex items-center gap-1.5 text-[11px] text-muted">
        <MapPin size={11} />
        {latitude.toFixed(5)}, {longitude.toFixed(5)}
        {" · "}
        <a
          href={`https://www.google.com/maps?q=${latitude},${longitude}`}
          target="_blank"
          rel="noreferrer"
          className="hover:text-primary"
        >
          {/* The engineer going there wants turn-by-turn directions, which is not
              something this map is for. */}
          Open in Google Maps
        </a>
      </p>
    </div>
  );
};
