import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { deleteClerkUser, syncClerkUser } from "services";
import { Webhook } from "svix";

// Clerk is the source of truth for identity; this webhook mirrors its users into
// our Users table so the rest of the app can keep joining on Users.uuid. It is a
// Route Handler (not a Server Action) by necessity: it's called by an external
// service, needs the raw request body for signature verification, and is
// excluded from Clerk middleware in proxy.ts so that body arrives untouched.

type ClerkEmailAddress = {
  id: string;
  email_address: string;
};

type ClerkPhoneNumber = {
  id: string;
  phone_number: string;
};

type ClerkUserData = {
  id: string;
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string | null;
  phone_numbers?: ClerkPhoneNumber[];
  primary_phone_number_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
  unsafe_metadata?: Record<string, unknown>;
};

type ClerkWebhookEvent = {
  type: string;
  data: ClerkUserData;
};

const metaString = (
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | null => {
  const value = metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const primaryEmail = (data: ClerkUserData): string | null => {
  const list = data.email_addresses ?? [];
  const primary =
    list.find((entry) => entry.id === data.primary_email_address_id) ?? list[0];
  return primary?.email_address ?? null;
};

const primaryPhone = (data: ClerkUserData): string | null => {
  const list = data.phone_numbers ?? [];
  const primary =
    list.find((entry) => entry.id === data.primary_phone_number_id) ?? list[0];
  return primary?.phone_number ?? null;
};

const fullNameOf = (data: ClerkUserData): string => {
  const fromMeta = metaString(data.unsafe_metadata, "fullName");
  if (fromMeta) {
    return fromMeta;
  }
  const composed = [data.first_name, data.last_name]
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .trim();
  return composed.length > 0 ? composed : "Unnamed user";
};

export const POST = async (request: Request) => {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    throw new Error(
      "Missing required environment variable: CLERK_WEBHOOK_SIGNING_SECRET",
    );
  }

  const headerList = await headers();
  const svixId = headerList.get("svix-id");
  const svixTimestamp = headerList.get("svix-timestamp");
  const svixSignature = headerList.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const payload = await request.text();

  let event: ClerkWebhookEvent;
  try {
    event = new Webhook(secret).verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const email = primaryEmail(event.data);
    if (!email) {
      return NextResponse.json(
        { error: "User has no email address" },
        { status: 400 },
      );
    }

    await syncClerkUser({
      clerkUserId: event.data.id,
      email,
      fullName: fullNameOf(event.data),
      phone: primaryPhone(event.data),
      companyName: metaString(event.data.unsafe_metadata, "companyName"),
      location: metaString(event.data.unsafe_metadata, "location"),
      image: event.data.image_url ?? null,
    });
  }

  if (event.type === "user.deleted") {
    await deleteClerkUser(event.data.id);
  }

  return new NextResponse(null, { status: 204 });
};
