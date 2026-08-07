"use client";

import { commitBatch } from "@/app/(dashboard)/imports/action";
import { PackageCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { Button, FormError } from "ui";

type CommitBatchButtonProps = {
  batchUuid: string;
};

export const CommitBatchButton = ({ batchUuid }: CommitBatchButtonProps) => {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const commit = () =>
    startTransition(async () => {
      const result = await commitBatch(batchUuid);
      setError(result.error);
    });

  return (
    <div className="flex flex-col items-end gap-2">
      <Button type="button" disabled={isPending} onClick={commit}>
        <PackageCheck size={15} />
        {isPending ? "Committing…" : "Commit what's ready"}
      </Button>
      {/* A partial commit reports as an error rather than a tick, because "212
          in, 3 still stuck" is something the reviewer has to go and act on — but
          the 212 did land, and the message says so rather than implying a
          rollback that never happened. */}
      <FormError message={error} />
    </div>
  );
};
