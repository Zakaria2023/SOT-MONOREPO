import { getSpaceAction } from "@/app/(dashboard)/spaces/action";
import { PageHeader } from "@/components/shared/page-header";
import { SpaceItemsTable } from "@/components/spaces/space-items-table";
import { SpaceLocation } from "@/components/spaces/space-location";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type Props = {
  params: Promise<{ uuid: string }>;
};

const AdminSpacePage = async ({ params }: Props) => {
  const { uuid } = await params;
  const detail = await getSpaceAction(uuid);
  if (!detail) {
    notFound();
  }

  const { space, items, summary } = detail;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/spaces"
        className="inline-flex w-fit items-center gap-2 text-sm text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft size={15} />
        All sites
      </Link>

      <PageHeader
        title={space.name}
        description={`${summary.units} installed · ${summary.retired} replaced · ${summary.firmwareVerified} firmware versions confirmed, ${summary.firmwareDeclared} still unchecked`}
      />

      <SpaceLocation
        name={space.name}
        latitude={space.address?.latitude ?? null}
        longitude={space.address?.longitude ?? null}
      />

      <SpaceItemsTable items={items} />
    </div>
  );
};

export default AdminSpacePage;
