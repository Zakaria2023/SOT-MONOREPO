import { AdditionCheckPanel } from "@/components/spaces/addition-check";
import { ServiceDoor } from "@/components/spaces/service-door";
import { SpaceMap } from "@/components/spaces/space-map";
import { SpaceRegister } from "@/components/spaces/space-register";
import { getCurrentUser } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  checkCartAgainstSpace,
  getServiceView,
  getSpace,
  listSpaceRequests,
} from "services";

type Props = {
  params: Promise<{ uuid: string }>;
};

export const metadata: Metadata = pageMetadata({
  title: "Your site",
  description: "The equipment installed at this site.",
  path: "/spaces",
  noIndex: true,
});

const SpacePage = async ({ params }: Props) => {
  const { uuid } = await params;

  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  // Ownership is inside the read, not checked after it. A register listing which
  // locks and cameras are fitted and where is not something to fetch first and
  // decide about second.
  const detail = await getSpace(user.uuid, uuid);
  if (!detail) {
    notFound();
  }

  const { space, items, summary } = detail;
  const address = space.address;

  // Today is decided HERE and passed down, not read inside the schedule. The
  // schedule stays pure and testable, and every clock on the page is measured from
  // the same instant — a render that asked the clock three times could show one
  // item due and another overdue across a midnight boundary.
  const today = new Date().toISOString().slice(0, 10);
  const [service, requests, addition] = await Promise.all([
    getServiceView(user.uuid, uuid, today),
    listSpaceRequests(user.uuid, uuid),
    // Judged against the project answers the customer already gave, so this and
    // checkout cannot reach different verdicts on the same basket.
    checkCartAgainstSpace({ userUuid: user.uuid, spaceUuid: uuid }),
  ]);

  return (
    <main className="mx-auto px-6 py-12 lg:px-12 xl:px-20">
      <Link
        href="/spaces"
        className="font-grotesk inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft size={15} />
        All sites
      </Link>

      <h1 className="font-heading mt-4 text-2xl text-ink">{space.name}</h1>
      {address && (
        <p className="font-grotesk mt-1 text-sm text-muted">
          {[address.line, address.district, address.city, address.region]
            .filter(Boolean)
            .join(", ")}
        </p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[18px] border border-search-border bg-surface p-5">
          <p className="font-grotesk text-xs text-muted">Installed</p>
          <p className="font-heading mt-1 text-xl text-ink">{summary.units}</p>
        </div>
        <div className="rounded-[18px] border border-search-border bg-surface p-5">
          <p className="font-grotesk text-xs text-muted">Replaced over time</p>
          <p className="font-heading mt-1 text-xl text-ink">
            {summary.retired}
          </p>
        </div>
        <div className="rounded-[18px] border border-search-border bg-surface p-5">
          <p className="font-grotesk text-xs text-muted">
            Firmware you have told us
          </p>
          <p className="font-heading mt-1 text-xl text-ink">
            {summary.firmwareDeclared + summary.firmwareVerified}
          </p>
          {/* The distinction the whole firmware design turns on, said plainly
              rather than left as a green tick somebody would read as checked. */}
          {summary.firmwareVerified > 0 && (
            <p className="font-grotesk mt-0.5 text-xs text-muted">
              {summary.firmwareVerified} confirmed by SOT
            </p>
          )}
        </div>
      </div>

      {/* Above the register and the map, because it is the only part of this page
          with anything to DO on it. */}
      {service && (
        <ServiceDoor
          spaceUuid={space.uuid}
          view={service}
          requests={requests}
        />
      )}

      <AdditionCheckPanel spaceName={space.name} check={addition} />

      <SpaceMap
        spaceUuid={space.uuid}
        latitude={address?.latitude ?? null}
        longitude={address?.longitude ?? null}
      />

      <SpaceRegister items={items} />
    </main>
  );
};

export default SpacePage;
