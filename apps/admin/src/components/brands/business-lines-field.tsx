"use client";

import type { BrandFormValues } from "@/app/(dashboard)/brands/validation";
import { businessLines } from "@/db/enum";
import { BUSINESS_LINE_LABELS } from "@/db/label";
import { Controller } from "react-hook-form";
import type { Control } from "react-hook-form";
import { Checkbox } from "ui";

type BusinessLinesFieldProps = {
  control: Control<BrandFormValues>;
};

export const BusinessLinesField = ({ control }: BusinessLinesFieldProps) => (
  <div className="flex flex-col gap-2">
    <label className="text-sm font-semibold text-ink">Business lines</label>
    <p className="text-xs text-muted">
      Products inherit these from the brand — pick every line this brand sells
      into.
    </p>
    <Controller
      control={control}
      name="businessLines"
      render={({ field }) => (
        <div className="flex flex-wrap gap-x-6 gap-y-3 rounded-control border border-hairline p-4">
          {businessLines.map((line) => (
            <Checkbox
              key={line}
              label={BUSINESS_LINE_LABELS[line]}
              checked={field.value.includes(line)}
              onChange={(event) =>
                field.onChange(
                  event.target.checked
                    ? [...field.value, line]
                    : field.value.filter((value) => value !== line),
                )
              }
            />
          ))}
        </div>
      )}
    />
  </div>
);
