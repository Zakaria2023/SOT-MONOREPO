"use client";

import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";
import { useEffect } from "react";

// Windows doesn't render flag emojis (it shows the country code instead). This
// injects a flags-only web font ("Twemoji Country Flags") that the font stacks
// reference, so flag emojis render everywhere. It's a no-op on platforms that
// already support them (macOS, iOS, Android).
//
// The font is served from our own origin. Left to itself the polyfill fetches it
// from jsDelivr, which CSP blocked and which put a third-party origin back on the
// critical path right after the main fonts were brought in-house. The file is
// copied from the package's own dist, so it is the same font, not a lookalike.
const FLAG_FONT_URL = "/fonts/TwemojiCountryFlags.woff2";

export const FlagEmojiPolyfill = () => {
  useEffect(() => {
    polyfillCountryFlagEmojis("Twemoji Country Flags", FLAG_FONT_URL);
  }, []);

  return null;
};
