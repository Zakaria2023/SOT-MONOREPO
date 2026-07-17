"use client";

import type { PartnerRequestListItem } from "@/app/(dashboard)/partners/action";
import {
  approvePartnerRequestAction,
  rejectPartnerRequestAction,
} from "@/app/(dashboard)/partners/action";
import { PartnerRequestReviewDialog } from "@/components/partners/partner-request-review-dialog";
import type { PartnerBadge } from "@/db/enum";
import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "ui";

type PartnerRequestRowActionsProps = {
  request: PartnerRequestListItem;
};

export const PartnerRequestRowActions = ({
  request,
}: PartnerRequestRowActionsProps) => {
  const router = useRouter();
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [badge, setBadge] = useState<PartnerBadge>("reseller");
  const [isIntegrated, setIsIntegrated] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isSubmitting, startTransition] = useTransition();

  const resetDialog = () => {
    setMode(null);
    setRejectionReason("");
    setBadge("reseller");
    setIsIntegrated(false);
    setError(undefined);
  };

  const closeDialog = () => {
    if (isSubmitting) return;
    resetDialog();
  };

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approvePartnerRequestAction(
        request.uuid,
        badge,
        isIntegrated,
      );

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
      const result = await rejectPartnerRequestAction(request.uuid, {
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
        <PartnerRequestReviewDialog
          open
          mode={mode}
          partnerName={request.fullName}
          email={request.email}
          rejectionReason={rejectionReason}
          badge={badge}
          isIntegrated={isIntegrated}
          isSubmitting={isSubmitting}
          error={error}
          onRejectionReasonChange={setRejectionReason}
          onBadgeChange={setBadge}
          onIntegratedChange={setIsIntegrated}
          onConfirm={mode === "approve" ? handleApprove : handleReject}
          onCancel={closeDialog}
        />
      )}
    </>
  );
};
