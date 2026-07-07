"use client";

import { useOfferForm } from "@/app/boqs/[uuid]/use-offer-form";
import { CheckCircle2, Cpu, Package, Send, Wrench } from "lucide-react";
import { Input, Textarea } from "ui";
import type { OfferInput } from "validators";

type OfferFormProps = {
  boqUuid: string;
  showProgramming: boolean;
  submitLabel: string;
  defaultValues: OfferInput;
};

export const OfferForm = ({
  boqUuid,
  showProgramming,
  submitLabel,
  defaultValues,
}: OfferFormProps) => {
  const {
    form: {
      register,
      formState: { errors },
    },
    state,
    isPending,
    onSubmit,
  } = useOfferForm({ boqUuid, defaultValues });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Input
          label="Product price"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          placeholder="0.00"
          icon={<Package size={16} />}
          required
          error={errors.productPrice?.message}
          {...register("productPrice")}
        />
        <Input
          label="Installation price"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          placeholder="0.00"
          icon={<Wrench size={16} />}
          required
          error={errors.installPrice?.message}
          {...register("installPrice")}
        />
      </div>

      {showProgramming && (
        <Input
          label="Programming price"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          placeholder="0.00"
          icon={<Cpu size={16} />}
          required
          error={errors.programmingPrice?.message}
          {...register("programmingPrice")}
        />
      )}

      <Textarea
        label="Offer description"
        rows={4}
        placeholder="Describe what's included — scope, timeline, warranty, anything that sets your offer apart…"
        required
        error={errors.description?.message}
        {...register("description")}
      />

      {state.error && <p className="text-sm text-red-500">{state.error}</p>}
      {state.success && (
        <p className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle2 size={16} />
          Offer sent for review.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60"
      >
        <Send size={16} />
        {isPending ? "Sending…" : submitLabel}
      </button>
    </form>
  );
};
