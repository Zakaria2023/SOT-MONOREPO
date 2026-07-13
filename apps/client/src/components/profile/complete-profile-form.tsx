"use client";

import { useCompleteProfileForm } from "@/app/complete-profile/use-complete-profile-form";
import { LocationPicker } from "@/components/location/location-picker";
import { ArrowRight } from "lucide-react";
import { Controller } from "react-hook-form";

type CompleteProfileFormProps = {
  next: string;
};

export const CompleteProfileForm = ({ next }: CompleteProfileFormProps) => {
  const {
    form: {
      register,
      control,
      formState: { errors },
    },
    state,
    isPending,
    onSubmit,
  } = useCompleteProfileForm(next);

  return (
    <div className="relative w-full max-w-md rounded-3xl bg-surface p-9 shadow-[0_30px_80px_-24px_rgba(20,22,27,0.2),0_24px_70px_-34px_rgba(124,58,237,0.5)]">
      <div>
        <h1 className="font-heading text-3xl text-ink">Complete your profile</h1>
        <p className="font-grotesk mt-2 text-sm text-muted">
          Add your location so we can match your request with the right
          partners.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        className="font-grotesk mt-6 flex flex-col gap-4"
      >
        <input type="hidden" {...register("next")} />

        <Controller
          control={control}
          name="location"
          render={({ field }) => (
            <LocationPicker
              value={field.value ?? ""}
              onChange={field.onChange}
              error={errors.location?.message}
            />
          )}
        />

        {state.error && (
          <p className="font-grotesk text-sm text-red-500">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="font-grotesk mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-bold text-white shadow-[0_12px_30px_-8px_rgba(124,58,237,0.6)] transition-all hover:-translate-y-0.5 hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save & continue"}
          <ArrowRight size={18} />
        </button>
      </form>
    </div>
  );
};
