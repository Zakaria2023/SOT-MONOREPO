/**
 * Content-Security-Policy, built per request around a fresh nonce.
 *
 * A nonce rather than 'unsafe-inline' for scripts, because 'unsafe-inline' makes
 * script-src decorative: it permits exactly the injected inline script an XSS is
 * trying to run. Next reads the nonce out of this header and stamps it onto its
 * own bootstrap scripts; anything we hand-write inline has to carry it too.
 *
 * The allowed origins come from watching a real page load rather than from a
 * template. The storefront touches only itself and Clerk — the fonts are
 * self-hosted now, so there is no Google origin to allow.
 */
export const buildCsp = (nonce: string, isDev: boolean): string => {
  const clerk = "https://*.clerk.accounts.dev https://*.clerk.com";
  // Clerk fronts its bot check with Cloudflare Turnstile, which loads a script
  // and an iframe from Cloudflare.
  const turnstile = "https://challenges.cloudflare.com";

  const directives: Record<string, string> = {
    "default-src": "'self'",

    // `strict-dynamic` lets a nonce-approved script load further scripts, which
    // is how Clerk bootstraps the rest of itself. Without it the first script
    // runs and its children are blocked.
    //
    // 'unsafe-eval' only in development: the dev overlay and Fast Refresh
    // compile in the browser. Production gets no eval.
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      clerk,
      turnstile,
      isDev ? "'unsafe-eval'" : "",
    ]
      .filter(Boolean)
      .join(" "),

    // 'unsafe-inline' stays for styles and is not the hole it looks like: Next
    // and Tailwind inject inline style attributes during hydration, and CSS
    // cannot exfiltrate the way script can. A style nonce would break hydration.
    "style-src": "'self' 'unsafe-inline'",

    // data: for inlined SVG and the flag-emoji polyfill; blob: for anything
    // canvas-generated. https: because product images redirect to presigned R2
    // URLs whose host carries an account id we do not want pinned in a header.
    "img-src": "'self' data: blob: https:",

    "font-src": "'self' data:",

    // Clerk's session and environment calls. ws: in dev for Fast Refresh.
    "connect-src": ["'self'", clerk, isDev ? "ws: wss:" : ""]
      .filter(Boolean)
      .join(" "),

    // Turnstile renders in an iframe; Clerk hosts some flows in one.
    "frame-src": `'self' ${clerk} ${turnstile}`,

    // three.js and Clerk both construct workers from blobs.
    "worker-src": "'self' blob:",

    "manifest-src": "'self'",
    "media-src": "'self'",

    // No plugins, ever.
    "object-src": "'none'",

    // Stops an injected <base> silently repointing every relative URL on the
    // page at an attacker's host.
    "base-uri": "'self'",

    // A form cannot be made to post our data somewhere else.
    "form-action": "'self'",

    // The modern half of the clickjacking defence; X-Frame-Options is the other.
    "frame-ancestors": "'none'",
  };

  const policy = Object.entries(directives)
    .map(([key, value]) => `${key} ${value}`)
    .join("; ");

  // Not sent in development: the dev server serves over http, and this turns
  // every localhost request into an https one that nothing is listening for.
  return isDev ? policy : `${policy}; upgrade-insecure-requests`;
};

/** Per-request nonce. Web Crypto, so it works on the edge runtime. */
export const createNonce = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
};
