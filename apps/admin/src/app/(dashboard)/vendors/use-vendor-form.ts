"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { createVendor, updateVendor } from "./action";
import type { VendorActionResult, VendorFields } from "./action";
import { vendorFormSchema } from "./validation";
import type { VendorFormValues } from "./validation";
import type { SelectVendors } from "@/db/schema/vendors";

type UseVendorFormArgs =
  | { mode: "add" }
  | { mode: "edit"; vendor: SelectVendors };

export const useVendorForm = (args: UseVendorFormArgs) => {
  const action =
    args.mode === "edit"
      ? (prevState: VendorActionResult, fields: VendorFields) =>
          updateVendor(args.vendor.uuid, prevState, fields)
      : createVendor;

  const [state, dispatch, isPending] = useActionState(action, {});

  const vendor = args.mode === "edit" ? args.vendor : undefined;

  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      name: vendor?.name ?? "",
      idLabel: vendor?.idLabel ?? "",
      status: vendor?.status ?? "active",
      parentUuid: vendor?.parentUuid ?? "",
      notes: vendor?.notes ?? "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(() => {
      dispatch({
        name: values.name,
        idLabel: values.idLabel,
        status: values.status,
        parentUuid: values.parentUuid || null,
        notes: values.notes || null,
      });
    });
  });

  return { form, state, isPending, onSubmit };
};
