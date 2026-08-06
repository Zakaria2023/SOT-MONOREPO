"use client";

import { SelectProducts } from "@/db/schema/products";
import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { ProductClientFields } from "services";
import { createProduct, ProductActionResult, updateProduct } from "./action";
import { productFormSchema, ProductFormValues } from "./validation";

type UseProductFormArgs =
  | { mode: "add" }
  | {
      mode: "edit";
      product: SelectProducts;
    };

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
      variant: product?.variant ?? "",
      brandIdValue: product?.brandIdValue ?? "",
      seriesCode: product?.seriesCode ?? "",
      warrantyPeriod: product?.warrantyPeriod ?? "",
      warrantyRegion: product?.warrantyRegion ?? "",
      countryOfOrigin: product?.countryOfOrigin ?? "",
      shortDescription: product?.shortDescription ?? "",
      datasheet: product?.datasheet ?? "",
      description: product?.description ?? "",
      image: product?.image ?? "",
      images: product?.images ?? [],
      price: product?.price ?? "",
      currency: product?.currency ?? "SAR",
      isAvailable: product?.isAvailable ?? true,
      // WHICH attributes a product carries is not stored — it is resolved from
      // the category's assignment chain, so adding an attribute to a category
      // applies to every product in it immediately.
      specValues: product?.specValues ?? {},
      status: product?.status ?? "in_stock",
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
        variant: values.variant || null,
        brandIdValue: values.brandIdValue || null,
        seriesCode: values.seriesCode || null,
        warrantyPeriod: values.warrantyPeriod || null,
        warrantyRegion: values.warrantyRegion || null,
        countryOfOrigin: values.countryOfOrigin || null,
        shortDescription: values.shortDescription || null,
        datasheet: values.datasheet || null,
        description: values.description || null,
        image: values.image || null,
        images: values.images ?? [],
        price: values.price || null,
        currency: values.currency,
        isAvailable: values.isAvailable,
        specValues: values.specValues,
        status: values.status,
        order: values.order,
      });
    });
  });

  return { form, state, isPending, onSubmit };
};
