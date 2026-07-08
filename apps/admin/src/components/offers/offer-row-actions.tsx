"use client";

import type { OfferRow } from "@/app/(dashboard)/offers/action";
import {
  approveOfferAction,
  rejectOfferAction,
} from "@/app/(dashboard)/offers/action";
import { OfferRejectDialog } from "@/components/offers/offer-reject-dialog";
import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "ui";

type OfferRowActionsProps = {
  offer: OfferRow;
};

export const OfferRowActions = ({ offer }: OfferRowActionsProps) => {
  const router = useRouter();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [isSubmitting, startTransition] = useTransition();

  const closeReject = () => {
    if (isSubmitting) return;
    setRejectOpen(false);
    setRejectionReason("");
    setError(undefined);
  };

  const handleApprove = () => {
    startTransition(async () => {
      setError(undefined);
      const result = await approveOfferAction(offer.uuid);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      const result = await rejectOfferAction(offer.uuid, { rejectionReason });
      if (result.error) {
        setError(result.error);
        return;
      }
      setRejectOpen(false);
      setRejectionReason("");
      router.refresh();
    });
  };

  if (offer.status !== "pending") {
    return <span className="text-faint">—</span>;
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="primary"
            className="px-3"
            disabled={isSubmitting}
            onClick={handleApprove}
          >
            <Check size={16} />
            Approve
          </Button>

          <Button
            type="button"
            variant="danger"
            className="px-3"
            disabled={isSubmitting}
            onClick={() => {
              setError(undefined);
              setRejectionReason("");
              setRejectOpen(true);
            }}
          >
            <X size={16} />
            Reject
          </Button>
        </div>
        {error && !rejectOpen && (
          <p className="text-xs text-danger">{error}</p>
        )}
      </div>

      <OfferRejectDialog
        open={rejectOpen}
        partnerName={offer.partnerName ?? "this partner"}
        rejectionReason={rejectionReason}
        isSubmitting={isSubmitting}
        error={error}
        onRejectionReasonChange={setRejectionReason}
        onConfirm={handleReject}
        onCancel={closeReject}
      />
    </>
  );
};
