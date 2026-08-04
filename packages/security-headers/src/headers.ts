/**
 * Response headers every app sends, defined once.
 *
 * None of the five apps sent any of these. Each is a different failure it
 * prevents, so they are commented individually rather than as a block — a header
 * nobody can explain is a header somebody deletes.
 */
export const SECURITY_HEADERS: { key: string; value: string }[] = [
  {
    // Stops a browser from second-guessing a Content-Type. Without it, a file we
    // serve as text/plain can be sniffed as HTML and run as a script.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Send the full URL only to ourselves. A BOQ or order page carries a uuid in
    // its path, and the default policy leaks that path to any third party the
    // page links out to.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // HSTS. Once seen, the browser refuses plain HTTP for this host for a year,
    // which closes the first-request downgrade window. `preload` is deliberately
    // omitted: submitting to the preload list is close to irreversible and is a
    // decision to make on purpose, not a side effect of a header commit.
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    // Nothing here needs a camera, a microphone or a location, so nothing gets
    // to ask. Also covers features a compromised embed might reach for.
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()",
  },
  {
    // Legacy clickjacking defence, kept alongside CSP's frame-ancestors because
    // older browsers honour only this one.
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // `same-origin-allow-popups`, NOT `same-origin`. The stricter value severs
    // window.opener for popups we open ourselves, which is exactly how Clerk's
    // social sign-in talks back to the page — the popup completes and the opener
    // never hears about it, so the user lands nowhere. This value still stops a
    // cross-origin opener from reaching into us, which is the attack, while
    // leaving our own OAuth popup working.
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups",
  },
];

/**
 * Deliberately absent, because each of these breaks something here:
 *
 *   Cross-Origin-Embedder-Policy — would require every cross-origin resource to
 *     opt in with CORP. Clerk's scripts do not, so the app stops loading.
 *   Cross-Origin-Resource-Policy: same-origin — would stop apps/api serving the
 *     mobile client on Expo web, which is a different origin by definition.
 *   X-XSS-Protection — retired, and the filter it enabled introduced its own
 *     vulnerabilities. CSP replaces it.
 */
