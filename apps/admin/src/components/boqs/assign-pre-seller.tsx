"use client";

import type { PreSellerOption } from "@/app/(dashboard)/boqs/action";
import { assignBoqAction } from "@/app/(dashboard)/boqs/action";
import { Dropdown, FormError } from "ui";
import { useMemo, useState, useTransition } from "react";

type AssignPreSellerProps = {
  boqUuid: string;
  assignedId: string | null;
  preSellers: PreSellerOption[];
};

export const AssignPreSeller = ({
  boqUuid,
  assignedId,
  preSellers,
}: AssignPreSellerProps) => {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Mirrors the choice locally so a rejected assignment can be rolled back to
  // what the server still believes. Reading straight from the prop meant a
  // failure left the dropdown displaying a pre-seller who was never assigned.
  const [selected, setSelected] = useState(assignedId ?? "");

  const options = useMemo(
    () => [
      { value: "", label: "Unassigned" },
      ...preSellers.map((preSeller) => ({
        value: preSeller.id,
        label: preSeller.name,
      })),
    ],
    [preSellers],
  );

  // assignBoqAction returns an ActionResult and can come back with
  // `fail(error, "Failed to assign pre-seller")`. That message used to be
  // written and then dropped on the floor: the call was fired with `void`, so a
  // rejected assignment looked exactly like a successful one and the BOQ stayed
  // unassigned with nobody any the wiser.
  const assign = (value: string) => {
    const previous = selected;
    setSelected(value);
    setError(null);

    startTransition(async () => {
      const result = await assignBoqAction(boqUuid, value);
      if (result.error) {
        setSelected(previous);
        setError(result.error);
      }
    });
  };

  return (
    <div className="flex w-48 flex-col gap-1">
      <Dropdown
        value={selected}
        onChange={assign}
        options={options}
        placeholder="Unassigned"
      />
      <FormError message={error ?? undefined} />
    </div>
  );
};
