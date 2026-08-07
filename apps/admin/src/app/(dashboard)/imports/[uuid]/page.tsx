import { ImportQueueSection } from "@/components/imports/import-queue-section";
import { AsyncSection } from "@/components/shared/async-section";
import { PageHeader } from "@/components/shared/page-header";
import { notFound } from "next/navigation";
import { getImportBatch } from "services";

type Props = {
  params: Promise<{ uuid: string }>;
};

const ImportBatchPage = async ({ params }: Props) => {
  const { uuid } = await params;
  const batch = await getImportBatch(uuid);
  if (!batch) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={batch.source}
        description="Answer a question once and it is answered for every product that asked it."
      />

      <AsyncSection reloadKey={`import-queue-${uuid}`}>
        <ImportQueueSection batchUuid={uuid} />
      </AsyncSection>
    </div>
  );
};

export default ImportBatchPage;
