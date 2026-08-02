"use client";

import { useClassificationForm } from "@/app/(dashboard)/classifications/use-classification-form";
import type { SelectClassifications } from "@/db/schema/classifications";
import { Layers } from "lucide-react";
import Link from "next/link";
import { Button, FormError, Input } from "ui";

type ClassificationFormProps =
  { mode: "add" } | { mode: "edit"; classification: SelectClassifications };

export const ClassificationForm = (props: ClassificationFormProps) => {
  const { mode } = props;

  const { form, state, isPending, onSubmit } = useClassificationForm(
    mode === "edit"
      ? { mode: "edit", classification: props.classification }
      : { mode: "add" },
  );
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
          <Layers size={20} />
        </div>
        <h2 className="font-heading text-xl text-ink">
          {mode === "edit" ? "Edit classification" : "Create classification"}
        </h2>
      </div>

      <Input
        label="Name"
        labelIcon={<Layers size={15} />}
        type="text"
        {...register("name")}
        error={errors.name?.message}
      />

      <FormError message={state.error} />

      <div className="flex items-center gap-3 border-t border-hairline pt-5">
        <Button type="submit" disabled={isPending}>
          {mode === "edit"
            ? isPending
              ? "Saving..."
              : "Save Changes"
            : isPending
              ? "Creating..."
              : "Create Classification"}
        </Button>
        <Link
          href="/classifications"
          className="text-sm text-secondary hover:underline"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
};
