# mobile

The React Native mobile client for SOT, built with **Expo** (SDK 52) and
**Expo Router**. It mirrors `apps/client` but for iOS/Android, and talks to the
backend exclusively through the versioned REST API in `apps/api` (`/api/v1`) —
it never imports `packages/services` or touches the database directly.

## Architecture

- **Routing** — file-based via Expo Router under `src/app` (like the client's
  `src/app`). Route groups: `(auth)` for sign-in, `(tabs)` for the signed-in
  app, and `product/[uuid]` pushed as a stack screen.
- **Auth** — Clerk via `@clerk/clerk-expo`. The session token is cached in the
  device keychain (`expo-secure-store`) and sent to `apps/api` as
  `Authorization: Bearer <token>` — exactly what `getUserFromRequest` expects.
- **Data** — `src/lib/api.ts` is a typed `fetch` wrapper over `/api/v1`. DTOs in
  `src/lib/types.ts` mirror the service return shapes.

## Prerequisites

- Node 20+ and `pnpm` (already used by the monorepo).
- The **Expo Go** app on your phone (App Store / Play Store), or an
  Android emulator / iOS simulator.
- `apps/api` running and reachable from your phone.

## 1. Install dependencies

From the **repo root**:

```bash
pnpm install
```

> **pnpm + Metro note:** `metro.config.js` is tuned for pnpm — it watches the
> repo root and keeps Metro's hierarchical lookup on so it can follow pnpm's
> symlinks into the `.pnpm` virtual store (that lookup is what resolves
> transitive deps like `@expo/metro-runtime`). Babel injects `@babel/runtime`
> helper imports into app source, so it's declared as a direct dependency here.
> A production JS bundle has been verified with `expo export`, so a clean
> `pnpm install` should Just Work. If you ever add a library whose transitive
> helper isn't resolvable, declare it directly in `apps/mobile/package.json`.

## 2. Configure environment

There is **no separate mobile env file**. `app.config.js` reads the monorepo
root `.env.local` (the same file every other app uses) at startup and passes the
values to the app via `expo-constants`. It uses these keys from that file:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — the Clerk publishable key.
- `EXPO_PUBLIC_API_URL` — the base URL of `apps/api` for the **mobile app**.
  This points at the **deployed API** (`https://sot-monorepo-api.vercel.app`),
  so the app works without running `apps/api` locally. If it's unset, the config
  falls back to `NEXT_PUBLIC_API_URL`, then `http://localhost:3002`.

Because it targets the hosted API, you can skip "Start the API" below and go
straight to running the app. To point at a **local** server instead (e.g. to
test API changes), override the base URL at launch — no file edit needed:

```bash
# local server on the same machine (simulator/web):
EXPO_PUBLIC_API_URL=http://localhost:3002 pnpm dev:mobile
# physical phone in Expo Go — use your PC's LAN IP (find it with `ipconfig`),
# phone + PC on the same Wi-Fi; Android emulator uses http://10.0.2.2:3002
EXPO_PUBLIC_API_URL=http://192.168.1.20:3002 pnpm dev:mobile
```

## 3. Start the API (optional)

The app defaults to the **deployed** API, so you can skip this. Only start a
local server if you're testing API changes — and then launch the app with the
matching `EXPO_PUBLIC_API_URL` override shown above.

```bash
pnpm dev:api        # apps/api on http://localhost:3002
```

## 4. Start the mobile app

```bash
pnpm dev:mobile     # === pnpm --filter mobile dev === expo start
```

Then:

- **Phone:** scan the QR code with Expo Go (Android) or the Camera app (iOS).
- **Android emulator:** press `a` in the Expo terminal.
- **iOS simulator (macOS only):** press `i`.
- **Web preview:** press `w`.

Sign in with an email that exists in Clerk — you'll receive a 6-digit code.
After sign-in you land on the Products tab (Products / Categories / Cart /
Profile), and tapping a product opens its detail screen where you can add it to
your cart.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev:mobile` (root) | Start the Expo dev server |
| `pnpm --filter mobile android` | Open on a connected Android device/emulator |
| `pnpm --filter mobile ios` | Open on the iOS simulator (macOS) |
| `pnpm --filter mobile type-check` | `tsc --noEmit` |

## Notes

- `src/lib/format.ts` keeps a local copy of `formatPrice`. Metro won't transform
  the workspace `utils` package's raw-TS entry point, so cross-app helpers are
  duplicated locally here rather than imported from `"utils"`.
- `@types/react` is pinned to v19 to match the rest of the monorepo (the other
  apps are React 19). The mobile **runtime** stays on `react@18.3.1`, which is
  what Expo SDK 52 / React Native 0.76 require — only the types are aligned, so
  `tsc` doesn't see two conflicting copies of `@types/react`. It's listed under
  `expo.install.exclude` so `expo install --fix` won't downgrade it.
- Building standalone binaries (TestFlight / Play Store) uses EAS Build:
  `npx eas build`. That's beyond local development and not required to run the
  app in Expo Go.
