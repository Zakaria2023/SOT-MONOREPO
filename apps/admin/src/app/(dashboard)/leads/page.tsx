import { getLeadsAction } from "@/app/(dashboard)/leads/action";
import { AsyncSection } from "@/components/shared/async-section";
import { PageHeader } from "@/components/shared/page-header";
import { LeadDesk } from "@/components/leads/lead-desk";

const Desk = async () => {
  const leads = await getLeadsAction();
  return <LeadDesk leads={leads} />;
};

const LeadsPage = () => (
  <div className="flex flex-col gap-5">
    <PageHeader
      title="Leads"
      description="Capture, qualify, route. Nothing goes to a partner until it is qualified."
    />

    <AsyncSection reloadKey="leads">
      <Desk />
    </AsyncSection>
  </div>
);

export default LeadsPage;
