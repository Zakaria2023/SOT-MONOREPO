import { VendorsTable } from "@/components/vendors/vendors-table";
import { Plus } from "lucide-react";
import Link from "next/link";
import { getVendors } from "./action";

const VendorsPage = async () => {
  const vendors = await getVendors();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-ink">Vendors</h1>

        <Link
          href="/vendors/new"
          className="flex items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          <Plus size={16} />
          Add Vendor
        </Link>
      </div>

      <VendorsTable vendors={vendors} />
    </div>
  );
};

export default VendorsPage;
