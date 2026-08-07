import { CommitBatchButton } from "@/components/imports/commit-batch-button";
import { IssueGroupCard } from "@/components/imports/issue-group-card";
import { ImportRowList } from "@/components/imports/import-row-list";
import { CheckCircle2 } from "lucide-react";
import {
  getImportRows,
  getOpenIssueGroups,
  loadOptionSetIndex,
  resolveVocabulary,
  getCatalogModel,
} from "services";

type ImportQueueSectionProps = {
  batchUuid: string;
};

export const ImportQueueSection = async ({
  batchUuid,
}: ImportQueueSectionProps) => {
  // One model load serves every card's option list, rather than a query per
  // group. A batch can easily carry sixty groups, and the connection pool is
  // four wide across every app in the monorepo.
  const [groups, rows, model, sets] = await Promise.all([
    getOpenIssueGroups(batchUuid),
    getImportRows(batchUuid),
    getCatalogModel(),
    loadOptionSetIndex(),
  ]);

  // Indexed once rather than searched per card: sixty groups against a
  // hundred-and-fifty attributes is a scan nobody needs to run nine thousand
  // times to render one page.
  const byUuid = new Map(
    model.definitions.map((definition) => [definition.uuid, definition]),
  );

  const optionsFor = (specificationUuid: string | null) => {
    if (!specificationUuid) {
      return [];
    }
    const definition = byUuid.get(specificationUuid);
    return definition ? resolveVocabulary(definition, sets).options : [];
  };

  return (
    <div className="flex flex-col gap-6">
      {groups.length === 0 ? (
        <div className="flex items-center gap-3 rounded-card border border-hairline bg-surface p-5">
          <CheckCircle2 size={20} className="text-success" />
          <p className="text-sm text-ink">
            Nothing is waiting. Every row with no open question can be committed.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-heading text-lg text-ink">
              {groups.length} question{groups.length === 1 ? "" : "s"}
            </h2>
            {/* Ordered by reach, so the decision that clears the most products
                is the one at the top. */}
            <p className="text-sm text-faint">Most products first</p>
          </div>
          {groups.map((group) => (
            <IssueGroupCard
              key={group.groupKey}
              batchUuid={batchUuid}
              group={group}
              options={optionsFor(group.specificationUuid)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-heading text-lg text-ink">
            {rows.length} product{rows.length === 1 ? "" : "s"}
          </h2>
          <CommitBatchButton batchUuid={batchUuid} />
        </div>
        <ImportRowList rows={rows} />
      </div>
    </div>
  );
};
