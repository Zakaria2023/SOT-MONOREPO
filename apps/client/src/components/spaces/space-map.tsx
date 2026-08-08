"use client";

import { setSpaceLocationAction } from "@/app/spaces/[uuid]/actions";
import { MapPin, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useState, useTransition } from "react";

// Where the site is, on a map rather than as two numbers.
//
// LEAFLET CANNOT BE SERVER-RENDERED. It reaches for `window` at import time, so
// the canvas is pulled in with `ssr: false` — this file is the boundary that says
// so, and the reason the canvas is a separate module rather than an inline import.
//
// The click IS the input. Two coordinate boxes would be the obvious build and the
// worse one: nobody knows their latitude, everybody can point at their own
// building, and a typed decimal place in the wrong position moves a site a hundred
// kilometres with nothing on screen to make that visible.

type SpaceMapProps = {
  spaceUuid: string;
  latitude: number | null;
  longitude: number | null;
};

const SpaceMapCanvas = dynamic(
  () => import("./space-map-canvas").then((module) => module.SpaceMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 w-full animate-pulse rounded-[14px] bg-hover" />
    ),
  },
);

export const SpaceMap = ({
  spaceUuid,
  latitude,
  longitude,
}: SpaceMapProps) => {
  // Held locally so the pin moves under the cursor immediately. Waiting for the
  // round trip would make a map feel broken, and the server is the authority on
  // whether it sticks — which is what the error below is for.
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    latitude !== null && longitude !== null
      ? { lat: latitude, lng: longitude }
      : null,
  );
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const save = (lat: number | null, lng: number | null): void => {
    setError(undefined);
    const previous = pin;
    setPin(lat !== null && lng !== null ? { lat, lng } : null);

    startTransition(async () => {
      const result = await setSpaceLocationAction(spaceUuid, lat, lng);
      if (result.error) {
        // Put it back. A pin left where the server refused it would have the map
        // quietly disagreeing with the record.
        setPin(previous);
        setError(result.error);
      }
    });
  };

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-heading text-lg text-ink">Where it is</h2>
          <p className="font-grotesk mt-0.5 text-sm text-muted">
            {pin
              ? "Click anywhere on the map to move the pin."
              : "Click the map to mark where this site is. It helps us send the right engineer to the right gate."}
          </p>
        </div>

        {pin && (
          <button
            type="button"
            onClick={() => save(null, null)}
            disabled={pending}
            className="font-grotesk inline-flex items-center gap-1.5 rounded-full border border-search-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink disabled:opacity-60"
          >
            <Trash2 size={12} />
            Remove pin
          </button>
        )}
      </div>

      {error && (
        <p className="font-grotesk mt-3 rounded-control border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-3 overflow-hidden rounded-[18px] border border-search-border">
        <SpaceMapCanvas
          latitude={pin?.lat ?? null}
          longitude={pin?.lng ?? null}
          editable
          onPick={(lat, lng) => save(lat, lng)}
        />
      </div>

      {pin && (
        <p className="font-grotesk mt-2 inline-flex items-center gap-1.5 text-xs text-muted">
          <MapPin size={11} />
          {/* Five decimal places is roughly a metre. More would be false
              precision from a click on a tiled map. */}
          {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
        </p>
      )}
    </section>
  );
};
