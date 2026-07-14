import { count } from "drizzle-orm";
import { db } from "../../../db";
import { Boqs } from "../../../db/schema/boqs";
import { Brands } from "../../../db/schema/brands";
import { Categories } from "../../../db/schema/categories";
import { GovernmentRequests } from "../../../db/schema/government-requests";
import { Offers } from "../../../db/schema/offers";
import { PartnerRequests } from "../../../db/schema/partner-requests";
import { Products } from "../../../db/schema/products";
import { Specifications } from "../../../db/schema/specifications";
import { Users } from "../../../db/schema/users";

// One status bucket of a grouped count, e.g. { status: "pending", total: 4 }.
export type StatusCount = {
  status: string;
  total: number;
};

export type SectionStats = {
  total: number;
  byStatus: StatusCount[];
};

export type AdminDashboardStats = {
  products: SectionStats;
  categories: SectionStats;
  brands: SectionStats;
  specifications: SectionStats;
  users: SectionStats;
  boqs: SectionStats;
  offers: SectionStats;
  partnerRequests: SectionStats;
  governmentRequests: SectionStats;
};

// Sums grouped rows into { total, byStatus }, dropping empty buckets.
const toSectionStats = (
  rows: { status: string | null; total: number }[],
): SectionStats => {
  const byStatus = rows
    .filter((row) => row.total > 0)
    .map((row) => ({ status: row.status ?? "unknown", total: row.total }));
  return {
    total: byStatus.reduce((sum, row) => sum + row.total, 0),
    byStatus,
  };
};

const plainStats = (rows: { total: number }[]): SectionStats => ({
  total: rows[0]?.total ?? 0,
  byStatus: [],
});

/** Entity counts for the admin dashboard, grouped by status where one exists. */
export const getAdminDashboardStats =
  async (): Promise<AdminDashboardStats> => {
    try {
      const [
        products,
        categories,
        brands,
        specifications,
        users,
        boqs,
        offers,
        partnerRequests,
        governmentRequests,
      ] = await Promise.all([
        db
          .select({ status: Products.status, total: count() })
          .from(Products)
          .groupBy(Products.status),
        db.select({ total: count() }).from(Categories),
        db.select({ total: count() }).from(Brands),
        db.select({ total: count() }).from(Specifications),
        db.select({ total: count() }).from(Users),
        db
          .select({ status: Boqs.status, total: count() })
          .from(Boqs)
          .groupBy(Boqs.status),
        db
          .select({ status: Offers.status, total: count() })
          .from(Offers)
          .groupBy(Offers.status),
        db
          .select({ status: PartnerRequests.status, total: count() })
          .from(PartnerRequests)
          .groupBy(PartnerRequests.status),
        db
          .select({ status: GovernmentRequests.status, total: count() })
          .from(GovernmentRequests)
          .groupBy(GovernmentRequests.status),
      ]);

      return {
        products: toSectionStats(products),
        categories: plainStats(categories),
        brands: plainStats(brands),
        specifications: plainStats(specifications),
        users: plainStats(users),
        boqs: toSectionStats(boqs),
        offers: toSectionStats(offers),
        partnerRequests: toSectionStats(partnerRequests),
        governmentRequests: toSectionStats(governmentRequests),
      };
    } catch {
      throw new Error("Failed to fetch dashboard statistics");
    }
  };
