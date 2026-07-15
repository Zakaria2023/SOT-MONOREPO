import { notFound } from "next/navigation";
import { VendorForm } from "@/components/vendors/vendor-form";
import { getVendor, getVendors } from "../../action";

type Props = {
  params: Promise<{ uuid: string }>;
};

const EditVendorPage = async ({ params }: Props) => {
  const { uuid } = await params;

  const [vendor, vendors] = await Promise.all([
    getVendor(uuid),
    getVendors(),
  ]);

  if (!vendor) {
    notFound();
  }

  return (
    <VendorForm
      mode="edit"
      vendor={vendor}
      vendors={vendors.filter((item) => item.uuid !== uuid)}
    />
  );
};

export default EditVendorPage;
