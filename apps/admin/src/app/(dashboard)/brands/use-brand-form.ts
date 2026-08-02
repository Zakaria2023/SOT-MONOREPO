"use client";

import { SelectBrands } from "@/db/schema/brands";
import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { BrandFields } from "services";
import { BrandActionResult, createBrand, updateBrand } from "./action";
import { brandFormSchema, BrandFormValues } from "./validation";

type UseBrandFormArgs = { mode: "add" } | { mode: "edit"; brand: SelectBrands };

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
