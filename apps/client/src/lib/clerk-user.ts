import type { ClerkUserSync } from "services";

type BuildClerkUserSyncInput = {
  clerkUserId: string;
  email: string | null;
  phone: string | null;
  image: string | null;
  firstName: string | null;
  lastName: string | null;
  // Sign-up form fields ride in unsafeMetadata; government invitations carry
  // entity details in publicMetadata.
  metadata: Record<string, unknown>;
  publicMetadata?: Record<string, unknown>;
};

const str = (meta: Record<string, unknown>, key: string): string | null => {
  const value = meta[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const parseType = (value: string | null): ClerkUserSync["type"] =>
  value === "individual" || value === "facility" || value === "government"
    ? value
    : null;

/**
 * Maps a Clerk user's identity + metadata into the shape our profile sync
 * expects. Shared by the webhook (raw event) and getCurrentUser (Clerk
 * resource) so both produce identical rows.
 */
export const buildClerkUserSync = ({
  clerkUserId,
  email,
  phone,
  image,
  firstName,
  lastName,
  metadata,
  publicMetadata = {},
}: BuildClerkUserSyncInput): ClerkUserSync => {
  const meta = { ...publicMetadata, ...metadata };
  const composedName = [firstName, lastName]
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .trim();

  return {
    clerkUserId,
    type: parseType(str(meta, "type")),
    email,
    phone: phone ?? str(meta, "contactNumber"),
    fullName: str(meta, "fullName") ?? (composedName || "Unnamed user"),
    firstName: str(meta, "firstName") ?? firstName,
    middleName: str(meta, "middleName"),
    lastName: str(meta, "lastName") ?? lastName,
    companyName: str(meta, "companyName") ?? str(meta, "entityName"),
    location: str(meta, "location"),
    image,
    unifiedNumber: str(meta, "unifiedNumber"),
    crNumber: str(meta, "crNumber"),
    vatNumber: str(meta, "vatNumber"),
    nationalAddress: str(meta, "nationalAddress"),
    crCertificate: str(meta, "crCertificate"),
    vatCertificate: str(meta, "vatCertificate"),
    representativeName: str(meta, "representativeName"),
    representativeMobile: str(meta, "representativeMobile"),
    representativeEmail: str(meta, "representativeEmail"),
  };
};
