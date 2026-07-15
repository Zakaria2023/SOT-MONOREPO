import { VendorForm } from "@/components/vendors/vendor-form";
import { getVendors } from "../action";

const NewVendorPage = async () => {
  const vendors = await getVendors();

  return <VendorForm mode="add" vendors={vendors} />;
};

export default NewVendorPage;
