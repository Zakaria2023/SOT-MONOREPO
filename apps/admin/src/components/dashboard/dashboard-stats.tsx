import {
  Award,
  FileText,
  Landmark,
  ListChecks,
  Network,
  Package,
  Tags,
  Ticket,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import {
  BOQ_STATUS_LABELS,
  GOVERNMENT_REQUEST_STATUS_LABELS,
  OFFER_STATUS_LABELS,
  PARTNER_REQUEST_STATUS_LABELS,
  PRODUCT_STATUS_LABELS,
} from "@/db/label";
import type { AdminDashboardStats, SectionStats } from "services";

type DashboardStatsProps = {
  stats: AdminDashboardStats;
};

type StatCardProps = {
  icon: LucideIcon;
  label: string;
  href: string | null;
  stats: SectionStats;
  statusLabels: Record<string, string>;
};

type StatCardConfig = {
  key: keyof AdminDashboardStats;
  icon: LucideIcon;
  label: string;
  href: string | null;
  statusLabels: Record<string, string>;
};

// Every admin section, in sidebar order. Customers has no admin page (yet), so
// its tile is not linked.
const CARDS: StatCardConfig[] = [
  {
    key: "products",
    icon: Package,
    label: "Products",
    href: "/products",
    statusLabels: PRODUCT_STATUS_LABELS,
  },
  {
    key: "categories",
    icon: Tags,
    label: "Categories",
    href: "/categories",
    statusLabels: {},
  },
  {
    key: "brands",
    icon: Award,
    label: "Brands",
    href: "/brands",
    statusLabels: {},
  },
  {
    key: "specifications",
    icon: ListChecks,
    label: "Specifications",
    href: "/library",
    statusLabels: {},
  },
  {
    key: "boqs",
    icon: FileText,
    label: "BOQs",
    href: "/boqs",
    statusLabels: BOQ_STATUS_LABELS,
  },
  {
    key: "offers",
    icon: Ticket,
    label: "Offers",
    href: "/offers",
    statusLabels: OFFER_STATUS_LABELS,
  },
  {
    key: "partnerRequests",
    icon: Network,
    label: "Partner Requests",
    href: "/partners",
    statusLabels: PARTNER_REQUEST_STATUS_LABELS,
  },
  {
    key: "governmentRequests",
    icon: Landmark,
    label: "Government Requests",
    href: "/government",
    statusLabels: GOVERNMENT_REQUEST_STATUS_LABELS,
  },
  {
    key: "users",
    icon: Users,
    label: "Customers",
    href: null,
    statusLabels: {},
  },
];

const StatCard = ({
  icon: Icon,
  label,
  href,
  stats,
  statusLabels,
}: StatCardProps) => (
  <article className="relative flex flex-col gap-4 rounded-card border border-hairline bg-surface p-5 shadow-[0_1px_2px_rgba(27,35,51,0.04)] transition-colors hover:border-primary">
    {href && (
      <Link
        href={href}
        aria-label={`View ${label}`}
        className="absolute inset-0"
      />
    )}

    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-primary-tint text-primary">
        <Icon size={19} />
      </div>
      <span className="text-sm font-semibold text-muted">{label}</span>
    </div>

    <p className="font-heading text-4xl text-ink">
      {stats.total.toLocaleString("en-US")}
    </p>

    {stats.byStatus.length > 0 && (
      <dl className="flex flex-col gap-1.5 border-t border-hairline pt-3">
        {stats.byStatus.map((bucket) => (
          <div
            key={bucket.status}
            className="flex items-center justify-between gap-3"
          >
            <dt className="text-sm text-muted">
              {statusLabels[bucket.status] ?? bucket.status}
            </dt>
            <dd className="text-sm font-semibold text-ink">
              {bucket.total.toLocaleString("en-US")}
            </dd>
          </div>
        ))}
      </dl>
    )}
  </article>
);

export const DashboardStats = ({ stats }: DashboardStatsProps) => (
  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
    {CARDS.map((card) => (
      <StatCard
        key={card.key}
        icon={card.icon}
        label={card.label}
        href={card.href}
        stats={stats[card.key]}
        statusLabels={card.statusLabels}
      />
    ))}
  </div>
);
