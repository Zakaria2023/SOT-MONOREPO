"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { createProduct, updateProduct } from "./action";
import type { ProductActionResult, ProductClientFields } from "./action";
import { productFormSchema } from "./validation";
import type { ProductFormValues } from "./validation";
import type { SelectProducts } from "@/db/schema/products";

type UseProductFormArgs =
  | { mode: "add" }
  | { mode: "edit"; product: SelectProducts };

export const useProductForm = (args: UseProductFormArgs) => {
  const action =
    args.mode === "edit"
      ? (prevState: ProductActionResult, fields: ProductClientFields) =>
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
      model: product?.model ?? "",
      productFamily: product?.productFamily ?? "",
      seriesCode: product?.seriesCode ?? "",
      partNumber: product?.partNumber ?? "",
      modelNumber: product?.modelNumber ?? "",
      bom: product?.bom ?? "",
      description: product?.description ?? "",
      role: product?.role ?? "",
      image: product?.image ?? "",
      images: product?.images ?? [],
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
        model: values.model || null,
        productFamily: values.productFamily || null,
        seriesCode: values.seriesCode || null,
        partNumber: values.partNumber || null,
        modelNumber: values.modelNumber || null,
        bom: values.bom || null,
        description: values.description || null,
        role: values.role || null,
        image: values.image || null,
        images: values.images ?? [],
        isFeatured: values.isFeatured,
        price: values.price || null,
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
