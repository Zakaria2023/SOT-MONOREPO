"use client";

import { documentImageUrl } from "@/lib/documents";
import { ImageOff } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { galleryFrames } from "utils";

// ---------------------------------------------------------------------------
// The product's pictures on the admin detail page.
//
// A client island rather than making the whole detail page interactive: the page
// also renders the spec table, the pricing block and the identity fields, none
// of which need the browser and all of which would stop being server-rendered to
// buy one piece of state.
//
// It exists at all because the strip it replaces was three separate faults, and
// each is worth naming so it does not come back:
//
//   BLURRY — `width={64} height={64}` asks next/image for a 64-pixel-wide file.
//   Displayed in a 64 CSS-pixel box on a 2× screen, that is a half-resolution
//   image stretched to fit. `fill` with a `sizes` hint lets Next build a srcset
//   and the browser take the 2× entry.
//
//   UNREADABLE — `object-cover` fills a square by cropping, and a rack switch is
//   a wide photo, so what survived the crop was the middle band: a grey smear
//   with no switch in it. Product pictures are `object-contain`, always. Nobody
//   inspecting a catalogue wants an artful crop, they want to see the thing.
//
//   INERT — the thumbnails had no click handler. They looked like controls,
//   behaved like decoration, and there was no way to see the second picture at
//   full size at all.
// ---------------------------------------------------------------------------

type ProductGalleryProps = {
  name: string;
  // The primary picture. Null when the product has none.
  image: string | null;
  // The extra pictures, as stored on the product.
  images: string[];
};

export const ProductGallery = ({ name, image, images }: ProductGalleryProps) => {
  const frames = galleryFrames(image, images);

  // The stored id, not an index. If the pictures are ever reordered an index
  // silently points at a different one, where an id either resolves or does not
  // — and the fallback below is what handles "does not".
  const [active, setActive] = useState<string | null>(image ?? null);
  const shown = active && frames.includes(active) ? active : frames[0];

  return (
    <>
      <div className="flex h-72 items-center justify-center overflow-hidden rounded-card border border-hairline bg-page">
        {shown ? (
          <Image
            // Keyed by what is being shown, so React swaps the element instead
            // of mutating one whose `src` changed — which is what stops the
            // previous picture lingering while the next one decodes.
            key={shown}
            src={documentImageUrl(shown)}
            alt={name}
            width={640}
            height={640}
            className="h-full w-full object-contain p-4"
          />
        ) : (
          <ImageOff size={40} className="text-faint" />
        )}
      </div>

      {/* One picture is not a gallery. A lone thumbnail under the frame is a
          control that does nothing, and it reads as a second picture that failed
          to load. */}
      {frames.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {frames.map((frame, index) => {
            const isShown = frame === shown;
            return (
              <button
                key={frame}
                type="button"
                onClick={() => setActive(frame)}
                aria-label={`Show picture ${index + 1} of ${frames.length}`}
                aria-current={isShown}
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-control border bg-surface transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                  isShown
                    ? "border-primary ring-1 ring-primary"
                    : "border-hairline hover:border-primary/50"
                }`}
              >
                {/* `fill` + `sizes` so Next serves a file big enough for a 2×
                    screen; `object-contain` so a wide product is visible rather
                    than cropped to its middle band. */}
                <Image
                  src={documentImageUrl(frame)}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-contain p-1"
                />
              </button>
            );
          })}
        </div>
      )}
    </>
  );
};
