import { getServiceRequestsAction } from "@/app/(dashboard)/service/action";
import { AsyncSection } from "@/components/shared/async-section";
import { PageHeader } from "@/components/shared/page-header";
import { ServiceQueue } from "@/components/service/service-queue";

const ServiceRequestList = async () => {
  const requests = await getServiceRequestsAction();
  return <ServiceQueue requests={requests} />;
};

const ServicePage = () => (
  <div className="flex flex-col gap-5">
    <PageHeader
      title="Visits"
      description="Callouts customers have asked for, and which of them nobody has booked."
    />

    <AsyncSection reloadKey="service">
      <ServiceRequestList />
    </AsyncSection>
  </div>
);

export default ServicePage;
