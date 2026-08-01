"use client";

import { documentDownloadUrl } from "@/lib/documents";
import { ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useState, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// The product's pictures, and the only interactive part of the hero.
//
// Split out rather than making the whole hero a client component: the hero also
// renders the price, the spec chips and the category — none of which need the
// browser, and all of which would stop being server-rendered to buy one piece of
// state.
//
// The chips arrive as `children` so they stay server-rendered while sitting
// inside the frame this component owns.
// ---------------------------------------------------------------------------

type ProductGalleryProps = {
  name: string;
  // The primary picture. Null when the product has none at all.
  image: string | null;
  // The extra pictures, as stored on the product.
  images: string[];
  // Overlaid on the frame — the spec chips.
  children?: ReactNode;
};

export const ProductGallery = ({
  name,
  image,
  images,
  children,
}: ProductGalleryProps) => {
  // The primary FIRST, then the rest, deduplicated. Without the primary in the
  // strip a shopper who clicks a thumbnail has no way back to the picture they
  // started on — and a product whose primary is also listed among its extras
  // would otherwise show the same thumbnail twice.
  const gallery = [...new Set([...(image ? [image] : []), ...images])];

  const [active, setActive] = useState(image);
  // The stored value, not an index. If the pictures are ever reordered, an index
  // silently points at a different one; an id either resolves or does not.
  const shown = active && gallery.includes(active) ? active : gallery[0];

  return (
    <div>
      <div className="relative flex h-105 items-center justify-center overflow-hidden rounded-card border border-hairline bg-surface-2">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(139,123,255,0.28),transparent_60%),radial-gradient(circle_at_75%_75%,rgba(34,211,238,0.22),transparent_55%)]"
        />
        {shown ? (
          <Image
            // Keyed by the picture being shown, so React swaps the element
            // rather than mutating one whose `src` changed — which is what stops
            // the previous picture lingering while the next decodes.
            key={shown}
            src={documentDownloadUrl(shown)}
            alt={name}
            fill
            unoptimized
            className="object-contain p-16"
          />
        ) : (
          <ShieldCheck size={96} className="text-primary/40" />
        )}

        {children}
      </div>

      {/* One picture is not a gallery — a lone thumbnail under the frame is a
          control that does nothing, and it reads as a second picture that failed
          to load. */}
      {gallery.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-3">
          {gallery.map((imageId, index) => {
            const isShown = imageId === shown;
            return (
              <button
                key={imageId}
                type="button"
                onClick={() => setActive(imageId)}
                aria-label={`Show picture ${index + 1} of ${gallery.length}`}
                aria-current={isShown}
                className={`relative aspect-square overflow-hidden rounded-control border bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isShown
                    ? "border-primary"
                    : "border-hairline hover:border-primary/50"
                }`}
              >
                <Image
                  src={documentDownloadUrl(imageId)}
                  alt=""
                  fill
                  unoptimized
                  className="object-contain p-2"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
