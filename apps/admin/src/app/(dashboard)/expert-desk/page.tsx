import { getQueueAction } from "@/app/(dashboard)/expert-desk/action";
import { QueueBoard } from "@/components/expert-desk/queue-board";
import { AsyncSection } from "@/components/shared/async-section";
import { PageHeader } from "@/components/shared/page-header";

// Both queues on one page, side by side — never interleaved into one list.
const Queues = async () => {
  const [designHelp, documentReview] = await Promise.all([
    getQueueAction("design_help"),
    getQueueAction("document_review"),
  ]);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
      <QueueBoard queue="design_help" requests={designHelp} />
      <QueueBoard queue="document_review" requests={documentReview} />
    </div>
  );
};

const ExpertDeskPage = () => (
  <div className="flex flex-col gap-5">
    <PageHeader
      title="Expert desk"
      description="Where a question goes when the system cannot answer it."
    />

    <AsyncSection reloadKey="expert-desk">
      <Queues />
    </AsyncSection>
  </div>
);

export default ExpertDeskPage;
