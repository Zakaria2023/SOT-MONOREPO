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
