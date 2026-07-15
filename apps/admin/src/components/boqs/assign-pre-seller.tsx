"use client";

import type { PreSellerOption } from "@/app/(dashboard)/boqs/action";
import { assignBoqAction } from "@/app/(dashboard)/boqs/action";
import { Dropdown } from "ui";
import { useMemo, useTransition } from "react";

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

  return (
    <div className="w-48">
      <Dropdown
        value={assignedId ?? ""}
        onChange={(value) =>
          startTransition(() => {
            void assignBoqAction(boqUuid, value);
          })
        }
        options={options}
        placeholder="Unassigned"
      />
    </div>
  );
};
