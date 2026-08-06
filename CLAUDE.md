# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository (`apps/admin` and `apps/client`).

## Monorepo Architecture

This is a pnpm + Turborepo monorepo built on Next.js 16.

**Apps**

- `apps/admin` — Next.js app for internal staff, protected by Clerk.
- `apps/client` — Next.js app for end customers (web), with its own login system.
- `apps/api` — Next.js app exposing ONLY Route Handlers, versioned under `/api/v1`. This is the sole interface the external mobile app (React Native) is allowed to talk to.

**Packages**

- `packages/services` — all business logic lives here as plain, framework-agnostic async functions. No `"use server"`, no request/response objects, no auth checks inside these functions, and no framework imports at all — that last one is why `next/cache` cannot be used here, so anything that needs caching or revalidation is wrapped in the app layer. Every operation (create user, place order, etc.) exists as exactly one function here, called by both Server Actions and Route Handlers. It is also the only place Drizzle is imported: services own database access, and nothing outside them — not client browser code, not the mobile app — talks to the database directly.
- `packages/validators` — zod schemas shared between Server Actions and Route Handlers so input validation never drifts between the two.
- `packages/utils` — framework-agnostic helper functions (formatters, `slugify`, `generateUuid`, pagination shapes like `ListParams`/`ListQuery`/`PaginatedResult`) shared across apps, imported from `"utils"`. Browser code imports this, so nothing server-only may go here.
- `packages/storage` — Cloudflare R2 access plus the shared Route Handler bodies for document upload/download/image, so each app's `route.ts` only imports and calls them.
- `packages/ui` — shared React components (`Dropdown`, `Table`, `ImageUpload`, `useFocusTrap`, …) used by the dashboard apps.
- `packages/rate-limit` — the request ceiling every app's `proxy.ts`/`middleware.ts` enforces, behind a `CounterStore` interface so the in-process counter can be swapped for a shared one.

The schema and connection live in the repo-root `db/` folder, not in a package — services import it by relative path (`../../../db`). There is no `packages/database` and no `packages/types`; shared types are exported from the package that owns them, usually `services` or `utils`.

**Calling convention**

- Server Actions (`"use server"`) are the only way admin and client call into services. They must stay thin: check the caller's identity, validate input, call exactly one `packages/services` function, return the result. No business logic inside an action.
- Route Handlers in `apps/api` exist solely for the mobile app (and any future external consumers). Same rule: thin, and they call the same `packages/services` functions — never a duplicate implementation.
- `admin` and `client` never call each other over HTTP — they each import `packages/services` directly, since they're server-rendered apps in the same repo.

**Auth**

- Clerk is the identity provider for **all** consumer surfaces: `apps/admin`, `apps/client`, and the mobile app. Do not reintroduce a custom password/JWT/session system.
- The `Users` table is **not** an identity store — it is a profile store. Clerk owns credentials, email/phone verification, and sessions. Each `Users` row is linked to Clerk by `clerkUserId` and is kept in sync by the Clerk webhook (`apps/client/src/app/api/webhooks/clerk/route.ts` → `syncClerkUser`). Extra profile fields (location, image, company, etc.) live on this row, not in Clerk.
- The web client uses `@clerk/nextjs`: `clerkMiddleware` in `proxy.ts`, `<ClerkProvider>` in the root layout. Sign-in/sign-up are custom-styled forms driven by Clerk's `useSignIn`/`useSignUp` hooks (email code + phone code verification) — Clerk sets the session cookie in the browser, so these run client-side rather than through a Server Action. `getCurrentUser` resolves the cookie session via Clerk's `auth()` then maps `userId → getUserByClerkId`.
- The mobile app authenticates directly with Clerk via the Clerk Flutter SDK and sends its session token as an `Authorization: Bearer` header to `apps/api`. `apps/api` verifies it networklessly with `@clerk/backend`'s `verifyToken`, then maps `sub → getUserByClerkId`. `apps/api` no longer exposes login/register/refresh/logout routes.
- Both transports resolve the caller to the same `AuthUser` (via `getUserByClerkId` in `packages/services`) before any service function runs. There is no password column, no `Sessions` table, and no `packages/auth` — Clerk owns credentials, verification, and session/refresh-token lifecycle entirely.

**Hard rules**

- No business logic inside a Server Action or Route Handler — only in `packages/services`.
- No direct database access from client components, the mobile app, or anywhere outside `packages/services`.
- Mobile never touches Drizzle or the database — only the versioned REST API.
- Never modify `db/index.ts` (the database connection/pool setup). Leave this file exactly as-is under all circumstances unless the user explicitly asks to change it.

## Package Manager

- Always use `pnpm` for installing dependencies and running scripts in this repo — never `npm` or `yarn`. (`npm install <pkg>` → `pnpm add <pkg>`, `npm run <script>` → `pnpm <script>`.)

## React

- Never use namespace-qualified React types like `React.ReactNode`, `React.FC`, `React.MouseEvent`, etc.
  Always import the specific type directly from `react`.

  ```tsx
  // ❌ Bad
  const foo: React.ReactNode = null;
  const handler: React.MouseEventHandler = () => {};

  // ✅ Good
  import type { ReactNode, MouseEventHandler } from "react";
  const foo: ReactNode = null;
  const handler: MouseEventHandler = () => {};
  ```

## Components & Functions

- Never use named function declarations. Always use arrow functions.
- When a component or function body is only a `return`, use the implicit arrow return — no curly braces, no `return` keyword. If the returned JSX spans multiple lines, wrap it in `()` instead of using `{ return ... }`.

  ```tsx
  // ❌ Bad
  function MyComponent() {
    return <div>Hello</div>;
  }

  // ❌ Also bad
  const MyComponent = () => {
    return <div>Hello</div>;
  };

  // ❌ Also bad — braces + return for multi-line JSX
  const MyComponent = () => {
    return (
      <div>
        <span>Hello</span>
      </div>
    );
  };

  // ✅ Good (single-line)
  const MyComponent = () => <div>Hello</div>;

  // ✅ Good (multi-line — parens instead of braces + return)
  const MyComponent = () => (
    <div>
      <span>Hello</span>
    </div>
  );
  ```

## Props

- Never define props inline. Always declare a named type above the component.
- All types in a file always live together at the top, above every function/component in that file — not interleaved as one type directly above each function. When a file has multiple components, group all their types first, then all the components.

  ```tsx
  // ❌ Bad
  const Button = ({
    label,
    onClick,
  }: {
    label: string;
    onClick: () => void;
  }) => <button onClick={onClick}>{label}</button>;

  // ❌ Bad — type placed directly above each function, interleaved
  type ButtonProps = {
    label: string;
    onClick: () => void;
  };

  const Button = ({ label, onClick }: ButtonProps) => (
    <button onClick={onClick}>{label}</button>
  );

  type CardProps = {
    title: string;
  };

  const Card = ({ title }: CardProps) => <div>{title}</div>;

  // ✅ Good — all types grouped together above all components
  type ButtonProps = {
    label: string;
    onClick: () => void;
  };

  type CardProps = {
    title: string;
  };

  const Button = ({ label, onClick }: ButtonProps) => (
    <button onClick={onClick}>{label}</button>
  );

  const Card = ({ title }: CardProps) => <div>{title}</div>;
  ```

## Icons

- Never use inline `<svg>` elements for icons. Always use [`lucide-react`](https://lucide.dev) instead.

  ```tsx
  // ❌ Bad
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="..." stroke="currentColor" />
  </svg>;

  // ✅ Good
  import { Layers } from "lucide-react";
  <Layers size={24} />;
  ```

## Images

- Never use a plain `<img>` tag. Always use `Image` from `next/image` instead.

  ```tsx
  // ❌ Bad
  <img src={category.image} alt={category.name} className="h-10 w-10" />;

  // ✅ Good
  import Image from "next/image";
  <Image
    src={category.image}
    alt={category.name}
    width={40}
    height={40}
    className="h-10 w-10"
  />;
  ```

## Dropdowns

- Never use a native `<select>` element. Always use the `Dropdown` component from `@/components/ui/dropdown` instead.

  ```tsx
  // ❌ Bad
  <select {...register("parentUuid")}>
    <option value="">No parent</option>
  </select>;

  // ✅ Good
  import { Dropdown } from "@/components/ui/dropdown";

  <Controller
    control={control}
    name="parentUuid"
    render={({ field }) => (
      <Dropdown
        value={field.value}
        onChange={field.onChange}
        placeholder="No parent"
        options={[{ value: "", label: "No parent" }]}
      />
    )}
  />;
  ```

## Navigation

- Never use a plain `<a>` tag for in-app navigation. Always use `Link` from `next/link` instead.

  ```tsx
  // ❌ Bad
  <a href="/products">Products</a>;

  // ✅ Good
  import Link from "next/link";
  <Link href="/products">Products</Link>;
  ```

- Never navigate imperatively with `useRouter().push()` inside an `onClick` for what is really just a link. Use `Link`. Reserve `useRouter().push()` for navigation that can't be expressed as a link (e.g. after some async work). For a whole clickable element (like a card) that also contains its own buttons, use a stretched `Link` overlay (`absolute inset-0`) plus `relative z-10` on the inner buttons — don't nest a `<button>` inside the `Link`.

  ```tsx
  // ❌ Bad — imperative navigation for a plain link
  const openProduct = (slug: string) => router.push(`/products/${slug}`);
  <article role="button" onClick={() => openProduct(slug)}>
    ...
  </article>;

  // ✅ Good — stretched Link overlay, buttons sit above it
  <article className="relative">
    <Link
      href={`/products/${slug}`}
      aria-label={`View ${name}`}
      className="absolute inset-0"
    />
    <button type="button" onClick={addToCart} className="relative z-10">
      Add
    </button>
  </article>;
  ```

## Linting

- Never disable a lint rule (`eslint-disable`, `eslint-disable-next-line`, etc.) to make a warning or error go away. Fix the underlying code so it satisfies the rule instead.

  ```tsx
  // ❌ Bad
  // eslint-disable-next-line @next/next/no-img-element
  <img src={category.image} alt={category.name} />;

  // ✅ Good — use the tool the rule is steering you toward
  import Image from "next/image";
  <Image src={category.image} alt={category.name} width={40} height={40} />;
  ```

## Tailwind CSS

- Never use arbitrary value syntax for spacing, sizing, or typography when a built-in Tailwind scale exists. Always prefer Tailwind's design tokens.

  ```tsx
  // ❌ Bad
  <p className="text-[22px] mt-[12px] w-[300px]" />

  // ✅ Good
  <p className="text-2xl mt-3 w-72" />
  ```

- Never use arbitrary letter-spacing values like `tracking-[-0.012em]`. Always use the built-in `tracking-*` scale (`tracking-tighter`, `tracking-tight`, `tracking-normal`, `tracking-wide`, etc.).

  ```tsx
  // ❌ Bad
  <h1 className="tracking-[-0.012em]" />

  // ✅ Good
  <h1 className="tracking-tight" />
  ```

- Never use the `truncate` class. Handle overflowing text another way (e.g. `line-clamp-*`, or let it wrap).

  ```tsx
  // ❌ Bad
  <p className="truncate" />

  // ✅ Good
  <p className="line-clamp-1" />
  ```

- Never use extra-bold or heavier font weights (`font-extrabold`, `font-black`). Keep text at `font-normal`, `font-medium`, or at most `font-semibold` for emphasis.

  ```tsx
  // ❌ Bad
  <span className="font-extrabold" />

  // ✅ Good
  <h3 className="font-bold" />
  <h3 className="font-semibold" />
  <span className="font-medium" />
  ```

## Exports

- Regular components use **named exports** — inline on the declaration is fine, just never `export default`.
- Only Next.js pages and layouts use `export default`, and it must be written at the **bottom** of the file, never inline.

  ```tsx
  // ❌ Bad — default export on a regular component
  export default const Card = () => <div />

  // ❌ Bad — default export on a regular component
  export default Card

  // ✅ Good — inline named export on a regular component
  export const Card = () => <div />

  // ✅ Good — page/layout with default export at the bottom
  const DashboardPage = () => (
    <main>...</main>
  )

  export default DashboardPage
  ```

## TypeScript

- Never use the non-null assertion operator (`!`). Always handle the missing case explicitly by throwing an error or returning early.
- Never use the `any` type. Use the actual type, `unknown` with a narrowing check, or a generic instead.

  ```ts
  // ❌ Bad
  const value = process.env.API_KEY!;

  // ✅ Good
  const value = process.env.API_KEY;
  if (!value) throw new Error("Missing required environment variable: API_KEY");
  ```

  ```ts
  // ❌ Bad
  const parseData = (data: any) => data.value;

  // ✅ Good
  const parseData = (data: unknown) => {
    if (typeof data !== "object" || data === null || !("value" in data)) {
      throw new Error("Invalid data shape");
    }
    return data.value;
  };
  ```

## Control Flow

- Never write a brace-less `if`. Every `if` (and `else`) body must be wrapped in `{}`, even when it's a single statement on its own line or an early `return`/`throw`.

  ```ts
  // ❌ Bad — brace-less single-statement if
  if (!boq) throw new Error("BOQ not found");

  // ❌ Also bad — brace-less early return
  if (!first) return null;

  // ✅ Good
  if (!boq) {
    throw new Error("BOQ not found");
  }

  if (!first) {
    return null;
  }
  ```

## Route Handlers

- When a route handler's logic is shared across apps (e.g. the `/api/documents/*` upload/download/delete endpoints), the handler body lives once in a package (e.g. `packages/storage`) as a plain function taking the Web `Request` (and route `context`). Never duplicate the body across apps.
- Each app's `route.ts` must **import and call** the shared handler from a normal handler export. Never use the `export { handler as METHOD } from "package"` re-export syntax — it's disallowed.

  ```ts
  // ❌ Bad — re-export syntax
  export { handleDocumentUpload as POST } from "storage";

  // ✅ Good — import and call the shared handler
  import { handleDocumentUpload } from "storage";

  export const POST = (request: Request) => handleDocumentUpload(request);

  // ✅ Good — handler that needs the route context (dynamic segment)
  import { handleDocumentDownload } from "storage";

  export const GET = (
    request: Request,
    context: { params: Promise<{ documentId: string }> },
  ) => handleDocumentDownload(request, context);
  ```

## Next.js Server Actions

- Always use Next.js Server Actions for data mutations and queries. Never create a new route handler (route.ts) to duplicate something a Server Action could do.
- If a route handler already exists for an operation (e.g. file upload/download), reuse it from the client (`fetch`) instead of writing a parallel Server Action that does the same thing.
- Server Actions should be defined in `actions.ts` files within feature directories.
- All Server Actions must have the `"use server"` directive at the top of the file.
- Always perform redirects on the server, inside the Server Action itself, using `redirect` from `next/navigation`. Never redirect on the client (e.g. via `router.push` after checking `state.success`).

  ```ts
  // ❌ Bad — using route handlers
  // app/api/addresses/route.ts
  export async function POST(request: Request) {
    const data = await request.json();
    // ...
  }

  // ✅ Good — using Server Actions
  // app/(dashboard)/addresses/actions.ts
  ("use server");

  export const createAddress = async (
    _prevState: ActionResult,
    data: CreateAddressInput,
  ): Promise<ActionResult> => {
    // ...
  };
  ```

  ```ts
  // ❌ Bad — a new Server Action that duplicates an existing route handler
  // app/(dashboard)/categories/action.ts
  ("use server");

  export const uploadCategoryImage = async (formData: FormData) => {
    // ... same upload logic app/api/documents/upload/route.ts already does
  };

  // ✅ Good — reuse the existing route handler from the client
  // app/api/documents/upload/route.ts already exists, so call it directly
  const response = await fetch("/api/documents/upload", {
    method: "POST",
    body: formData,
  });
  ```

  ```ts
  // ❌ Bad — redirecting on the client after a successful action
  const [state, dispatch, isPending] = useActionState(createAddress, {});

  useEffect(() => {
    if (state.success) router.push("/addresses");
  }, [state.success]);

  // ✅ Good — redirecting on the server, inside the action
  // app/(dashboard)/addresses/actions.ts
  ("use server");

  import { redirect } from "next/navigation";

  export const createAddress = async (
    _prevState: ActionResult,
    data: CreateAddressInput,
  ): Promise<ActionResult> => {
    // ... perform mutation
    redirect("/addresses");
  };
  ```

## Auth Checks

- Never call `requireAdmin` (or any other auth guard) from a `page.tsx`. A page is layout — it decides what the screen looks like, not who may see it. The check belongs where the data is reached: the Server Action, or the shared helper the action goes through (e.g. `adminListPage`). Middleware (`proxy.ts`) already gates every route before a page renders, so a guard in the page grants nothing the caller did not already have, and it costs a `currentUser()` round trip to Clerk whose result the page throws away.
- A page that reads a service directly with no action in front of it is still not the place for the guard. If that read needs a check of its own, give it an action; do not sprinkle `requireAdmin()` at the top of the page.

  ```tsx
  // ❌ Bad — guard in the page
  const OffersPage = async ({ searchParams }: Props) => {
    await requireAdmin();
    const { search, page } = await searchParams;
    // ...
  };

  // ✅ Good — page lays out, the action checks
  const OffersPage = async ({ searchParams }: Props) => {
    const { search, page } = await searchParams;
    // ...
  };

  // app/(dashboard)/offers/action.ts
  export const getOffersPage = async (
    params: ListParams = {},
  ): Promise<PaginatedResult<OfferRow>> => adminListPage(params, listOffers);
  ```

## Dynamic Route Params

- Page components for dynamic routes always type `params` as a `Promise` and `await` it to read the route values — never destructure `params` directly as a plain object.

  ```tsx
  // ❌ Bad
  type Props = {
    params: { uuid: string };
  };

  const CategoryEditPage = ({ params }: Props) => {
    const { uuid } = params;
    // ...
  };

  // ✅ Good
  type Props = {
    params: Promise<{ uuid: string }>;
  };

  const CategoryEditPage = async ({ params }: Props) => {
    const { uuid } = await params;
    // ...
  };
  ```

## Loading UI

- Never add route-level `loading.tsx` files. Show loading state with `<Suspense>` boundaries **inside** the page instead, wrapping only the async, data-dependent part (the table/list), with a static skeleton as the `fallback`.
- Give the `<Suspense>` a `key` derived from the relevant search params (e.g. `` key={`${search}-${page}`} ``) so changing the search/filter/page re-shows the fallback while the new data streams in — the fast, param-independent chrome (heading, toolbar, filters) stays mounted and outside the boundary.
- Move the param-dependent data fetch into a small async child component that the boundary wraps; the page component itself only awaits `searchParams` and renders the chrome + the boundary.
- Pair the `<Suspense>` with an error boundary so a thrown fetch shows a retry UI instead of erroring the whole route. In `apps/admin`, use the shared `<AsyncSection reloadKey={...}>` which bundles the keyed Suspense (skeleton fallback) and the error boundary (retry fallback) together — pass the async child as its children.

  ```tsx
  // ❌ Bad — app/(dashboard)/products/loading.tsx
  const Loading = () => <TableSkeleton />;
  export default Loading;

  // ✅ Good — Suspense inside the page, keyed on the params
  const ProductsList = async ({ search, page }: ProductsListProps) => {
    const result = await getProductsPage({ search, page });
    return (
      <>
        <ProductsTable products={result.items} />
        <Pagination {...result} />
      </>
    );
  };

  const ProductsPage = async ({ searchParams }: Props) => {
    const { search, page } = await searchParams;
    return (
      <div>
        <ListSearch placeholder="Search products..." />
        <Suspense key={`${search}-${page}`} fallback={<TableSkeleton />}>
          <ProductsList search={search} page={page} />
        </Suspense>
      </div>
    );
  };
  ```

## Form Submissions

- Always use `useActionState` from `react` when a form submits to a server action.
- Always pair it with `react-hook-form` and `zodResolver` for client-side validation.
- Call `dispatch(validatedData)` inside `handleSubmit` — never call the server action directly.
- Use `isPending` to disable the submit button and `state.error` to display server errors. Redirects on success happen inside the Server Action itself (see Server Actions above) — don't branch on `state.success` to redirect from the client.

  ```tsx
  // ❌ Bad — calling server action directly
  const onSubmit = handleSubmit(async (data) => {
    await createAddress({}, data);
  });

  // ✅ Good — routing through useActionState
  const [state, dispatch, isPending] = useActionState(createAddress, {});

  const { handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit((data) => {
    dispatch(data);
  });
  ```

## Specification authoring

- Before adding or shaping an attribute in the specification library, read
  `docs/specification-conventions.md`. It records the decisions where the model
  already does the right thing and only the usage was in question — how a range
  inside a repeatable row is expressed, how a "one fact, several cases" attribute
  is built and why its case column must be marked distinct, why external names
  are dotted and never re-derived, and where an unfamiliar source spelling
  belongs. Each entry names the attribute it came from, so a new case can be
  checked against the one that set the precedent.

## Enums

- Never use TypeScript's `enum`. Always define enums as a `const` array typed with `as const satisfies readonly string[]`, and derive the union type from it with `(typeof arr)[number]`.
- Never define an enum inline inside a database schema file (e.g. inline in the array argument to `mysqlEnum(...)`). Define it in `db/enum.ts` and import the const array into the schema file instead.
- All enums for the app live together in the single `db/enum.ts` file — not scattered across one-file-per-enum.
- Labels never live in `enum.ts`. All label maps live together in the single `db/label.ts` file instead, each exported as a `Record<EnumType, string>`.
- Shared JSON-column shape types (e.g. `SpecField`, `SpecOption`) live in `db/types.ts` and are imported by the schema files via a relative path (e.g. `../types`) rather than redefined inline.

  ```ts
  // ✅ Good — db/enum.ts
  export const productStatuses = [
    "draft",
    "published",
    "archived",
  ] as const satisfies readonly string[];

  export type ProductStatus = (typeof productStatuses)[number];
  ```

  ```ts
  // ✅ Good — db/label.ts
  import { ProductStatus } from "./enum";

  export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
    draft: "Draft",
    published: "Published",
    archived: "Archived",
  };
  ```

  ```ts
  // ❌ Bad — enum defined inline in the schema file
  // db/schema/products.ts
  status: mysqlEnum("status", ["draft", "published", "archived"]);

  // ✅ Good — import the const array from db/enum.ts
  // db/schema/products.ts
  import { productStatuses } from "../enum";

  status: mysqlEnum("status", productStatuses);
  ```

## Folder Structure

- The `actions.ts` file for a page always lives inside that page's own route folder in `app/`, next to its `page.tsx` — never in a separate top-level actions directory.
- Zod validation schemas and custom hooks for a page also live inside that same route folder in `app/`, next to `page.tsx` and `actions.ts` — not in `components/`, not in a top-level `hooks/` or `schemas/` directory.
- Components never live inside `app/`. All components live under a top-level `components/` folder, grouped into a subfolder named after the page/feature they belong to.

  ```
  // ✅ Good
  app/
    products/
      page.tsx
      actions.ts
      validation.ts (zod schema)
      hooks.ts

  components/
    products/
      product-card.tsx
      product-filters.tsx
  ```

  ```
  // ❌ Bad — components colocated inside app/, validation/hooks pulled out to top-level folders
  app/
    products/
      page.tsx
      actions.ts
      product-card.tsx
      product-filters.tsx

  schemas/
    products.ts

  hooks/
    use-products.ts
  ```

## Helpers

- Reusable helper/utility functions (formatters, parsers, URL builders, etc.) must never be defined inline at the top of a component file. Import them instead.
- Framework-agnostic helpers shared across apps (formatters like `formatMoney`/`formatPrice`, `slugify`, `generateUuid`, etc.) live in the shared `packages/utils` package and are imported from `"utils"`. This is the single home for cross-app helpers — do not re-add a per-app `src/lib/helpers.ts` that duplicates them.
- Only helpers that are genuinely specific to one app **and** tied to that app's transport/runtime (e.g. `apps/api`'s request/auth helpers that import `next/server`) stay in that app's `src/lib/*.ts`. Never put `next/server`-bound or otherwise app-specific code into `packages/utils`, since that package is imported by browser (client) code too.

  ```tsx
  // ❌ Bad — helper defined inline in the component file
  const formatPrice = (price: string, currency: string | null) =>
    `${currency ?? "SAR"} ${Number(price).toLocaleString("en-US")}`;

  export const ProductCard = ({ product }: ProductCardProps) => (
    <span>{formatPrice(product.price, product.currency)}</span>
  );

  // ❌ Also bad — re-defining a shared helper in a per-app src/lib/helpers.ts
  // apps/client/src/lib/helpers.ts
  export const formatPrice = (price: string, currency: string | null): string =>
    `${currency ?? "SAR"} ${Number(price).toLocaleString("en-US")}`;

  // ✅ Good — shared helper lives in packages/utils, imported from "utils"
  // packages/utils/src/index.ts
  export const formatPrice = (price: string, currency: string | null): string =>
    `${currency ?? "SAR"} ${Number(price).toLocaleString("en-US")}`;

  // product-card.tsx
  import { formatPrice } from "utils";

  export const ProductCard = ({ product }: ProductCardProps) => (
    <span>{formatPrice(product.price, product.currency)}</span>
  );
  ```

## File Naming

- All file names are always kebab-case, regardless of what's exported from them (components, hooks, schemas, etc.) — never PascalCase or camelCase file names.

  ```
  // ❌ Bad
  LocationForm.tsx
  useProducts.ts

  // ✅ Good
  location-form.tsx
  use-products.ts
  ```

## Database Schema

- Table definitions always use PascalCase — both the exported const name and the table name string passed in must be PascalCase and match each other.

  ```ts
  // ❌ Bad
  export const communication_settings = mysqlTable(
    "communication_settings",
    // ...columns
  );

  // ❌ Bad — mismatched casing
  export const communicationSettings = mysqlTable(
    "CommunicationSettings",
    // ...columns
  );

  // ✅ Good
  export const CommunicationSettings = mysqlTable(
    "CommunicationSettings",
    // ...columns
  );
  ```

## Service DTO Types

- Service DTO/list/detail types must derive every field that maps to a database column from the table's `Select*` type — via indexed access (`SelectX["field"]`), `Pick`, or `Omit` — never hand-typed. This keeps them in sync with the schema automatically. Add `| null` for a left-joined column, and wrap in `NonNullable<...>` for a column the query coalesces to non-null.
- Only genuinely computed values — SQL aggregates (`SUM`/`COUNT`, e.g. `itemCount`, `subtotal`) or composed values (e.g. `companyName || fullName`) — may be plain types, since no single column backs them.

  ```ts
  // ❌ Bad — passthrough columns re-typed by hand
  export type OfferListItem = SelectOffers & {
    boqReference: string | null;
    customerName: string | null;
  };

  // ✅ Good — each column-backed field derived from its DB type
  export type OfferListItem = SelectOffers & {
    boqReference: SelectBoqs["reference"] | null; // left-joined
    customerName: SelectUsers["fullName"] | null;
  };

  // ✅ Good — aggregates stay plain; coalesced column uses NonNullable
  export type PartnerBoqListItem = SelectBoqs & {
    matchRank: NonNullable<SelectBoqPartners["matchRank"]>;
    dispatchedAt: SelectBoqPartners["createdAt"];
  };

  export type BoqListItem = SelectBoqs & {
    customerName: SelectUsers["fullName"] | null;
    itemCount: number; // SUM(...) — no single column backs it
    subtotal: number; // SUM(...)
  };
  ```
