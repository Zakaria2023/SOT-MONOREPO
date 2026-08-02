"use server";

import { clerkClient } from "@clerk/nextjs/server";

type ClerkUserMetadata = {
  role?: string;
};

export type ClerkUserOption = {
  value: string;
  label: string;
};

export type DashboardUserOption = {
  id: string;
  label: string;
  value: string;
  email: string;
  role: string | null;
};

export const getClerkUsers = async (): Promise<DashboardUserOption[]> => {
  const client = await clerkClient();
  const response = await client.users.getUserList({ limit: 100 });

  return response.data
    .map((user) => {
      const name = user.fullName?.trim();
      const email =
        user.primaryEmailAddress?.emailAddress ??
        user.emailAddresses[0]?.emailAddress ??
        user.username ??
        user.id;
      const display = name && name !== email ? `${name} (${email})` : email;
      const metadata = user.publicMetadata as ClerkUserMetadata | undefined;

      return {
        id: user.id,
        label: display,
        value: display,
        email,
        role: typeof metadata?.role === "string" ? metadata.role : null,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
};

export const getClerkUsersForSelect = async (): Promise<ClerkUserOption[]> => {
  const client = await clerkClient();
  const response = await client.users.getUserList({ limit: 100 });

  return response.data
    .map((user) => ({
      value: user.id,
      label:
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        user.primaryEmailAddress?.emailAddress ||
        user.id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

export const getClerkAdminUsers = async (): Promise<DashboardUserOption[]> => {
  const users = await getClerkUsers();
  return users.filter((user) => user.role === "admin");
};

export const getClerkPreSellerUsers = async (): Promise<
  DashboardUserOption[]
> => {
  const users = await getClerkUsers();
  return users.filter((user) => user.role === "pre-seller");
};

/**
 * Give an email address a Clerk account carrying `publicMetadata`, and return
 * that account's id.
 *
 * Two paths, and the reason for the split is the whole point of this function:
 * an invitation only seeds the metadata of a brand-new signup. If the person
 * already has an account — a partner who first signed up as a customer, say —
 * inviting them would leave that account with role=undefined, and the partner
 * app's role gate would bounce them from a request they were just approved for.
 * So an existing account is updated in place instead, merging over whatever it
 * already carries.
 *
 * Approving a partner and approving a government entity both need exactly this,
 * and both used to spell it out; the comment above is what made having two
 * copies expensive.
 */
export const inviteOrAttachClerkUser = async (
  email: string,
  publicMetadata: Record<string, unknown>,
): Promise<string> => {
  const client = await clerkClient();

  const { data: existingUsers } = await client.users.getUserList({
    emailAddress: [email],
  });
  const [existingUser] = existingUsers;

  if (existingUser) {
    await client.users.updateUserMetadata(existingUser.id, {
      publicMetadata: { ...existingUser.publicMetadata, ...publicMetadata },
    });
    return existingUser.id;
  }

  const invitation = await client.invitations.createInvitation({
    emailAddress: email,
    ignoreExisting: true,
    publicMetadata,
  });

  return invitation.id;
};
