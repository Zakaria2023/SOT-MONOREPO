"use client";

import Link from "next/link";
import { useState } from "react";
import { uploadCategoryImage } from "@/app/(dashboard)/categories/action";
import { useCategoryForm } from "@/app/(dashboard)/categories/new/use-category-form";
import { CategoryDropdown } from "@/components/categories/category-dropdown";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SelectCategories } from "@/db/schema/categories";

type CategoryFormProps = {
  categories: SelectCategories[];
};

export const CategoryForm = ({ categories }: CategoryFormProps) => {
  const { form, state, isPending, onSubmit } = useCategoryForm();
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = form;

  const [isUploadingImage, setIsUploadingImage] = useState(false);

  return (
    <form
      onSubmit={onSubmit}
      className="flex max-w-xl flex-col gap-5 rounded-card border border-hairline bg-surface p-6"
    >
      <Input
        label="Name"
        type="text"
        {...register("name")}
        error={errors.name?.message}
      />

      <Textarea label="Description" rows={3} {...register("description")} />

      <CategoryDropdown control={control} categories={categories} />

      <ImageUpload
        label="Image"
        register={register("image")}
        upload={uploadCategoryImage}
        onUploaded={(documentId) => setValue("image", documentId)}
        onUploadingChange={setIsUploadingImage}
      />

      <FormError message={state.error} />

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending || isUploadingImage}>
          {isPending ? "Creating..." : "Create Category"}
        </Button>
        <Link
          href="/categories"
          className="text-sm text-secondary hover:underline"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
};
