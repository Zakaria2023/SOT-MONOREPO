"use client";

import { useVendorForm } from "@/app/(dashboard)/vendors/use-vendor-form";
import { VendorDropdown } from "@/components/vendors/vendor-dropdown";
import { vendorStatuses } from "@/db/enum";
import { VENDOR_STATUS_LABELS } from "@/db/label";
import type { SelectVendors } from "@/db/schema/vendors";
import { Button } from "ui";
import { Controller } from "react-hook-form";
import { Dropdown } from "ui";
import { FormError } from "ui";
import { Input } from "ui";
import { Textarea } from "ui";
import { Building2, Tag } from "lucide-react";
import Link from "next/link";

type VendorFormProps =
  | { mode: "add"; vendors: SelectVendors[] }
  | {
      mode: "edit";
      vendors: SelectVendors[];
      vendor: SelectVendors;
    };

const statusOptions = vendorStatuses.map((status) => ({
  value: status,
  label: VENDOR_STATUS_LABELS[status],
}));

export const VendorForm = (props: VendorFormProps) => {
  const { mode, vendors } = props;

  const { form, state, isPending, onSubmit } = useVendorForm(
    mode === "edit" ? { mode: "edit", vendor: props.vendor } : { mode: "add" },
  );
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-6 rounded-card border border-hairline bg-surface p-7 shadow-[0_1px_2px_rgba(27,35,51,0.04)]"
    >
      <div className="flex items-center gap-3 border-b border-hairline pb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-control bg-primary-tint text-primary">
          <Building2 size={20} />
        </div>
        <h2 className="font-heading text-xl text-ink">
          {mode === "edit" ? "Edit vendor" : "Create vendor"}
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Input
          label="Vendor Name"
          labelIcon={<Building2 size={15} />}
          type="text"
          placeholder="e.g. Huawei, Ajax, Grandstream"
          {...register("name")}
          error={errors.name?.message}
        />

        <Input
          label="ID Label"
          labelIcon={<Tag size={15} />}
          type="text"
          placeholder="e.g. BOM, PID, SKU, Part Number"
          {...register("idLabel")}
          error={errors.idLabel?.message}
        />

        <VendorDropdown
          control={control}
          name="parentUuid"
          vendors={vendors}
          label="Parent Vendor"
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-ink">Status</label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Dropdown
                value={field.value}
                onChange={field.onChange}
                options={statusOptions}
              />
            )}
          />
        </div>
      </div>

      <Textarea label="Notes" rows={3} {...register("notes")} />

      <FormError message={state.error} />

      <div className="flex items-center gap-3 border-t border-hairline pt-5">
        <Button type="submit" disabled={isPending}>
          {mode === "edit"
            ? isPending
              ? "Saving..."
              : "Save Changes"
            : isPending
              ? "Creating..."
              : "Create Vendor"}
        </Button>
        <Link href="/vendors" className="text-sm text-secondary hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
};
