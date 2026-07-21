"use client";

import { usePartnerDiscountsForm } from "@/app/(dashboard)/partner-discounts/use-partner-discounts-form";
import type { PartnerDiscountsFormValues } from "@/app/(dashboard)/partner-discounts/validation";
import { Percent } from "lucide-react";
import { PARTNER_CAPABILITY_LABELS, partnerCapabilities } from "validators";
import { Button, FormError, Input } from "ui";

type PartnerDiscountsFormProps = {
  defaults: PartnerDiscountsFormValues;
};

export const PartnerDiscountsForm = ({
  defaults,
}: PartnerDiscountsFormProps) => {
  const { form, state, isPending, onSubmit } = usePartnerDiscountsForm({
    defaults,
  });
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-6 rounded-card border border-hairline bg-surface p-7 shadow-[0_1px_2px_rgba(27,35,51,0.04)]"
    >
      <div className="flex items-center gap-3 border-b border-hairline pb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-control bg-primary-tint text-primary">
          <Percent size={20} />
        </div>
        <div>
          <h2 className="font-heading text-xl text-ink">Partner discounts</h2>
          <p className="mt-1 text-sm text-muted">
            A partner&apos;s discount off MSRP is the sum of the percentages for
            every capability they hold — they stack.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {partnerCapabilities.map((capability) => (
          <Input
            key={capability}
            label={PARTNER_CAPABILITY_LABELS[capability]}
            labelIcon={<Percent size={15} />}
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            {...register(capability, { valueAsNumber: true })}
            error={errors[capability]?.message}
          />
        ))}
      </div>

      {state.success && (
        <p className="text-sm font-medium text-success">Discounts saved.</p>
      )}
      <FormError message={state.error} />

      <div className="flex items-center gap-3 border-t border-hairline pt-5">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save discounts"}
        </Button>
      </div>
    </form>
  );
};
