"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { createProduct, updateProduct } from "./action";
import type { ProductActionResult, ProductFields } from "./action";
import { productFormSchema } from "./validation";
import type { ProductFormValues } from "./validation";
import type { SelectProducts } from "@/db/schema/products";

type UseProductFormArgs =
  | { mode: "add" }
  | { mode: "edit"; product: SelectProducts };

export const useProductForm = (args: UseProductFormArgs) => {
  const action =
    args.mode === "edit"
      ? (prevState: ProductActionResult, fields: ProductFields) =>
          updateProduct(args.product.uuid, prevState, fields)
      : createProduct;

  const [state, dispatch, isPending] = useActionState(action, {});

  const product = args.mode === "edit" ? args.product : undefined;

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      categoryUuid: product?.categoryUuid ?? "",
      brandUuid: product?.brandUuid ?? "",
      name: product?.name ?? "",
      slug: product?.slug ?? "",
      sku: product?.sku ?? "",
      model: product?.model ?? "",
      blurb: product?.blurb ?? "",
      description: product?.description ?? "",
      role: product?.role ?? "",
      image: product?.image ?? "",
      iconKey: product?.iconKey ?? "",
      ribbon: product?.ribbon ?? "",
      isFeatured: product?.isFeatured ?? false,
      price: product?.price ?? "",
      currency: product?.currency ?? "SAR",
      stock: product?.stock ?? 0,
      highlights: product?.highlights ?? [],
      specGroups: product?.specGroups ?? [],
      status: product?.status ?? "draft",
      order: product?.order ?? 0,
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(() => {
      dispatch({
        categoryUuid: values.categoryUuid,
        brandUuid: values.brandUuid,
        name: values.name,
        slug: values.slug,
        sku: values.sku || null,
        model: values.model || null,
        blurb: values.blurb || null,
        description: values.description || null,
        role: values.role || null,
        image: values.image || null,
        iconKey: values.iconKey || null,
        ribbon: values.ribbon || null,
        isFeatured: values.isFeatured,
        price: values.price,
        currency: values.currency,
        stock: values.stock,
        highlights: values.highlights ?? [],
        specGroups: values.specGroups ?? [],
        status: values.status,
        order: values.order,
      });
    });
  });

  return { form, state, isPending, onSubmit };
};
