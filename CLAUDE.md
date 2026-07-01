# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository (`apps/admin` and `apps/client`).

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

## Tailwind CSS

- Never use arbitrary value syntax for spacing, sizing, or typography when a built-in Tailwind scale exists. Always prefer Tailwind's design tokens.

  ```tsx
  // ❌ Bad
  <p className="text-[22px] mt-[12px] w-[300px]" />

  // ✅ Good
  <p className="text-2xl mt-3 w-72" />
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

## Next.js Server Actions

- Always use Next.js Server Actions for data mutations and queries. Never create Next.js route handlers (route.ts files in the app directory).
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

## Enums

- Never use TypeScript's `enum`. Always define enums as a `const` array typed with `as const satisfies readonly string[]`, and derive the union type from it with `(typeof arr)[number]`.
- Each enum lives in its own file (e.g. `company-role.ts`), exporting the const array and the derived type.
- Labels for rendering (the human-readable string per value) never live in the enum file. They live in a separate, co-located labels file (e.g. `company-role.labels.ts`), exported as a `Record<EnumType, string>`.

  ```ts
  // ✅ Good — company-role.ts
  export const companyRoles = [
    "customer",
    "prospect",
    "supplier",
    "processor",
    "transporter",
    "agent",
    "purchasing_org",
    "other",
    "internal",
  ] as const satisfies readonly string[];

  export type CompanyRole = (typeof companyRoles)[number];
  ```

  ```ts
  // ✅ Good — company-role.labels.ts
  import type { CompanyRole } from "./company-role";

  export const COMPANY_ROLE_LABELS: Record<CompanyRole, string> = {
    customer: "Customer",
    prospect: "Prospect",
    supplier: "Supplier",
    processor: "Processor",
    transporter: "Transporter",
    agent: "Agent",
    purchasing_org: "Purchasing Org.",
    other: "Other",
    internal: "Internal",
  };
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
      schema.ts
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
