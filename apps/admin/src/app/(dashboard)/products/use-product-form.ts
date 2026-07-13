"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { createProduct, updateProduct } from "./action";
import type { ProductActionResult, ProductClientFields } from "./action";
import { productFormSchema } from "./validation";
import type { ProductFormValues } from "./validation";
import type { SelectProducts } from "@/db/schema/products";
import type { SelectProductAliases } from "@/db/schema/product-aliases";
import type { SelectProductCategories } from "@/db/schema/product-categories";

type UseProductFormArgs =
  | { mode: "add" }
  | {
      mode: "edit";
      product: SelectProducts;
      aliases: SelectProductAliases[];
      linkedCategories: SelectProductCategories[];
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
      productFamily: product?.productFamily ?? "",
      seriesCode: product?.seriesCode ?? "",
      vendorNode: product?.vendorNode ?? "",
      warrantyPeriod: product?.warrantyPeriod ?? "",
      warrantyRegion: product?.warrantyRegion ?? "",
      warrantyExtendable: product?.warrantyExtendable ?? false,
      countryOfOrigin: product?.countryOfOrigin ?? "",
      shortDescription: product?.shortDescription ?? "",
      datasheet: product?.datasheet ?? "",
      aliases:
        args.mode === "edit"
          ? args.aliases.map((alias) => ({
              searchTerm: alias.searchTerm,
              termType: alias.termType,
              label: alias.label ?? "",
            }))
          : [],
      linkedCategories:
        args.mode === "edit"
          ? args.linkedCategories.map((link) => ({
              categoryUuid: link.categoryUuid,
            }))
          : [],
      description: product?.description ?? "",
      role: product?.role ?? "",
      image: product?.image ?? "",
      images: product?.images ?? [],
      isFeatured: product?.isFeatured ?? false,
      needsSolutionReview: product?.needsSolutionReview ?? false,
      price: product?.price ?? "",
      priceCost: product?.priceCost ?? "",
      priceSystemIntegrator: product?.priceSystemIntegrator ?? "",
      priceSubDistributor: product?.priceSubDistributor ?? "",
      priceEndUser: product?.priceEndUser ?? "",
      businessLine: product?.businessLine ?? "consumer",
      currency: product?.currency ?? "SAR",
      stock: product?.stock ?? 0,
      isAvailable: product?.isAvailable ?? true,
      technicalAttributes: product?.technicalAttributes ?? {},
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
        vendorNode: values.vendorNode || null,
        warrantyPeriod: values.warrantyPeriod || null,
        warrantyRegion: values.warrantyRegion || null,
        warrantyExtendable: values.warrantyExtendable,
        countryOfOrigin: values.countryOfOrigin || null,
        shortDescription: values.shortDescription || null,
        datasheet: values.datasheet || null,
        aliases: values.aliases.map((alias) => ({
          searchTerm: alias.searchTerm,
          termType: alias.termType,
          label: alias.label || null,
        })),
        linkedCategories: values.linkedCategories,
        description: values.description || null,
        role: values.role || null,
        image: values.image || null,
        images: values.images ?? [],
        isFeatured: values.isFeatured,
        needsSolutionReview: values.needsSolutionReview,
        price: values.price || null,
        priceCost: values.priceCost || null,
        priceSystemIntegrator: values.priceSystemIntegrator || null,
        priceSubDistributor: values.priceSubDistributor || null,
        priceEndUser: values.priceEndUser || null,
        businessLine: values.businessLine,
        currency: values.currency,
        stock: values.stock,
        isAvailable: values.isAvailable,
        technicalAttributes: values.technicalAttributes,
        status: values.status,
        order: values.order,
      });
    });
  });

  return { form, state, isPending, onSubmit };
};
