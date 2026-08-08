import { getMyLeadsAction } from "@/app/(dashboard)/leads/actions";
import { LeadFeed } from "@/components/leads/lead-feed";

const PartnerLeadsPage = async () => {
  const offers = await getMyLeadsAction();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl text-ink">Leads</h1>
        <p className="mt-1 text-sm text-muted">
          Enquiries we have qualified — the system, the size, the location, and
          somebody who has actually been spoken to.
        </p>
      </div>

      <LeadFeed offers={offers} />
    </div>
  );
};

export default PartnerLeadsPage;
