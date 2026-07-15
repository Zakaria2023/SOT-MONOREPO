"use client";

import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";
import { useEffect } from "react";

// Windows doesn't render flag emojis (it shows the country code instead). This
// injects a flags-only web font ("Twemoji Country Flags") that the font stacks
// reference, so flag emojis render everywhere. It's a no-op on platforms that
// already support them (macOS, iOS, Android).
export const FlagEmojiPolyfill = () => {
  useEffect(() => {
    polyfillCountryFlagEmojis();
  }, []);

  return null;
};
