"use client";

import {
  approveGovernmentRequestAction,
  rejectGovernmentRequestAction,
} from "@/app/(dashboard)/government/action";
import type { SelectGovernmentRequests } from "@/db/schema/government-requests";
import { GovernmentRequestReviewDialog } from "@/components/government/government-request-review-dialog";
import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "ui";

type GovernmentRequestRowActionsProps = {
  request: SelectGovernmentRequests;
};

export const GovernmentRequestRowActions = ({
  request,
}: GovernmentRequestRowActionsProps) => {
  const router = useRouter();
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [isSubmitting, startTransition] = useTransition();

  const resetDialog = () => {
    setMode(null);
    setRejectionReason("");
    setError(undefined);
  };

  const closeDialog = () => {
    if (isSubmitting) {
      return;
    }
    resetDialog();
  };

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveGovernmentRequestAction(request.uuid);
      if (result.error) {
        setError(result.error);
        return;
      }
      resetDialog();
      router.refresh();
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      const result = await rejectGovernmentRequestAction(request.uuid, {
        rejectionReason,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      resetDialog();
      router.refresh();
    });
  };

  if (request.status !== "pending") {
    return <span className="text-faint">-</span>;
  }

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="primary"
          className="px-3"
          onClick={() => {
            setError(undefined);
            setMode("approve");
          }}
        >
          <Check size={16} />
          Approve
        </Button>

        <Button
          type="button"
          variant="danger"
          className="px-3"
          onClick={() => {
            setError(undefined);
            setRejectionReason("");
            setMode("reject");
          }}
        >
          <X size={16} />
          Reject
        </Button>
      </div>

      {mode && (
        <GovernmentRequestReviewDialog
          open
          mode={mode}
          entityName={request.entityName}
          officialEmail={request.officialEmail}
          rejectionReason={rejectionReason}
          isSubmitting={isSubmitting}
          error={error}
          onRejectionReasonChange={setRejectionReason}
          onConfirm={mode === "approve" ? handleApprove : handleReject}
          onCancel={closeDialog}
        />
      )}
    </>
  );
};
