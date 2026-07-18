"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { createBrand, updateBrand } from "./action";
import type { BrandActionResult, BrandFields } from "./action";
import { brandFormSchema } from "./validation";
import type { BrandFormValues } from "./validation";
import type { SelectBrands } from "@/db/schema/brands";

type UseBrandFormArgs =
  | { mode: "add" }
  | { mode: "edit"; brand: SelectBrands };

export const useBrandForm = (args: UseBrandFormArgs) => {
  const action =
    args.mode === "edit"
      ? (prevState: BrandActionResult, fields: BrandFields) =>
          updateBrand(args.brand.uuid, prevState, fields)
      : createBrand;

  const [state, dispatch, isPending] = useActionState(action, {});

  const brand = args.mode === "edit" ? args.brand : undefined;

  const form = useForm<BrandFormValues>({
    resolver: zodResolver(brandFormSchema),
    defaultValues: {
      name: brand?.name ?? "",
      idLabel: brand?.idLabel ?? "",
      note: brand?.note ?? "",
      description: brand?.description ?? "",
      parentUuid: brand?.parentUuid ?? "",
      image: brand?.image ?? "",
      businessLines: brand?.businessLines ?? [],
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(() => {
      dispatch({
        name: values.name,
        idLabel: values.idLabel?.trim() || null,
        note: values.note?.trim() || null,
        description: values.description || null,
        parentUuid: values.parentUuid || null,
        image: values.image || null,
        businessLines: values.businessLines,
      });
    });
  });

  return { form, state, isPending, onSubmit };
};
