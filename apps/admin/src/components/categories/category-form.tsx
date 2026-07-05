"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useCategoryForm } from "@/app/(dashboard)/categories/use-category-form";
import { CategoryDropdown } from "@/components/categories/category-dropdown";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { documentDownloadUrl } from "@/lib/documents";
import type { SelectCategories } from "@/db/schema/categories";

type CategoryFormProps =
  | { mode: "add"; categories: SelectCategories[] }
  | { mode: "edit"; categories: SelectCategories[]; category: SelectCategories };

export const CategoryForm = (props: CategoryFormProps) => {
  const { mode, categories } = props;

  const { form, state, isPending, onSubmit } = useCategoryForm(
    mode === "edit" ? { mode: "edit", category: props.category } : { mode: "add" },
  );
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = form;

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const hasSubmittedRef = useRef(false);

  return (
    <form
      onSubmit={(event) => {
        hasSubmittedRef.current = true;
        onSubmit(event);
      }}
      className="flex max-w-xl flex-col gap-5 rounded-card border border-hairline bg-surface p-6"
    >
      <Input
        label="Name"
        type="text"
        {...register("name")}
        error={errors.name?.message}
      />

      <Textarea label="Description" rows={3} {...register("description")} />

      <CategoryDropdown
        control={control}
        name="parentUuid"
        categories={categories}
      />

      {mode === "edit" && (
        <Input
          label="Order"
          type="number"
          {...register("order", { valueAsNumber: true })}
          error={errors.order?.message}
        />
      )}

      <ImageUpload
        label="Image"
        register={register("image")}
        onUploaded={(documentId) => setValue("image", documentId)}
        onUploadingChange={setIsUploadingImage}
        submittedRef={hasSubmittedRef}
        previewUrl={
          mode === "edit" && props.category.image
            ? documentDownloadUrl(props.category.image)
            : null
        }
      />

      <FormError message={state.error} />

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending || isUploadingImage}>
          {mode === "edit"
            ? isPending
              ? "Saving..."
              : "Save Changes"
            : isPending
              ? "Creating..."
              : "Create Category"}
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
