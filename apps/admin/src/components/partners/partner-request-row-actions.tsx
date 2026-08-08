"use client";

import type { SelectPartnerRequests } from "@/db/schema/partner-requests";
import {
  approvePartnerRequestAction,
  rejectPartnerRequestAction,
  setPartnerIntegrationAction,
} from "@/app/(dashboard)/partners/action";
import { PartnerCapabilitiesDialog } from "@/components/partners/partner-capabilities-dialog";
import { PartnerCommercialDialog } from "@/components/partners/partner-commercial-dialog";
import { PartnerRequestReviewDialog } from "@/components/partners/partner-request-review-dialog";
import { BadgeCheck, Check, SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "ui";

type PartnerRequestRowActionsProps = {
  request: SelectPartnerRequests;
};

export const PartnerRequestRowActions = ({
  request,
}: PartnerRequestRowActionsProps) => {
  const router = useRouter();
  const [mode, setMode] = useState<
    "approve" | "reject" | "edit" | "capabilities" | null
  >(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isIntegrated, setIsIntegrated] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isSubmitting, startTransition] = useTransition();

  const resetDialog = () => {
    setMode(null);
    setRejectionReason("");
    setIsIntegrated(false);
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
      const result = await approvePartnerRequestAction(
        request.uuid,
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

  const handleSaveProfile = () => {
    startTransition(async () => {
      const result = await setPartnerIntegrationAction(
        request.uuid,
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

  // Approved partners get an Edit button for their commercial profile; other
  // non-pending states have no row action.
  if (request.status === "approved") {
    return (
      <>
        <div className="flex items-center justify-end gap-1">
          {/* What they may do, and what it is worth. Chosen at application and
              frozen until now — there was no way to award one later. */}
          <Button
            type="button"
            variant="ghost"
            className="px-3"
            onClick={() => {
              setError(undefined);
              setMode("capabilities");
            }}
          >
            <BadgeCheck size={16} />
            Capabilities
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="px-3"
            onClick={() => {
              setError(undefined);
              setIsIntegrated(request.isIntegrated);
              setMode("edit");
            }}
          >
            <SlidersHorizontal size={16} />
            Edit
          </Button>
        </div>

        {mode === "capabilities" && (
          <PartnerCapabilitiesDialog
            partnerUuid={request.uuid}
            partnerName={request.companyName ?? request.fullName}
            onClose={() => {
              resetDialog();
              router.refresh();
            }}
          />
        )}

        {mode === "edit" && (
          <PartnerCommercialDialog
            partnerName={request.fullName}
            isIntegrated={isIntegrated}
            isSubmitting={isSubmitting}
            error={error}
            onIntegratedChange={setIsIntegrated}
            onConfirm={handleSaveProfile}
            onCancel={closeDialog}
          />
        )}
      </>
    );
  }

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

      {(mode === "approve" || mode === "reject") && (
        <PartnerRequestReviewDialog
          open
          mode={mode}
          partnerName={request.fullName}
          email={request.email}
          rejectionReason={rejectionReason}
          isIntegrated={isIntegrated}
          isSubmitting={isSubmitting}
          error={error}
          onRejectionReasonChange={setRejectionReason}
          onIntegratedChange={setIsIntegrated}
          onConfirm={mode === "approve" ? handleApprove : handleReject}
          onCancel={closeDialog}
        />
      )}
    </>
  );
};
