"use client";

import { useCategoryForm } from "@/app/(dashboard)/categories/use-category-form";
import { CategoryDropdown } from "@/components/categories/category-dropdown";
import { Button } from "ui";
import { FormError } from "ui";
import { ImageUpload } from "ui";
import { Input } from "ui";
import { Textarea } from "ui";
import type { SelectCategories } from "@/db/schema/categories";
import { documentDownloadUrl } from "@/lib/documents";
import { Tags } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

type CategoryFormProps =
  | { mode: "add"; categories: SelectCategories[] }
  | {
      mode: "edit";
      categories: SelectCategories[];
      category: SelectCategories;
    };

export const CategoryForm = (props: CategoryFormProps) => {
  const { mode, categories } = props;

  const { form, state, isPending, onSubmit } = useCategoryForm(
    mode === "edit"
      ? { mode: "edit", category: props.category }
      : { mode: "add" },
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
      className="flex flex-col gap-6 rounded-card border border-hairline bg-surface p-7 shadow-[0_1px_2px_rgba(27,35,51,0.04)]"
    >
      <div className="flex items-center gap-3 border-b border-hairline pb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-control bg-primary-tint text-primary">
          <Tags size={20} />
        </div>
        <h2 className="font-heading text-xl text-ink">
          {mode === "edit" ? "Edit category" : "Create category"}
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Input
          label="Name"
          labelIcon={<Tags size={15} />}
          type="text"
          {...register("name")}
          error={errors.name?.message}
        />

        <CategoryDropdown
          control={control}
          name="parentUuid"
          categories={categories}
        />
      </div>

      <Textarea label="Description" rows={3} {...register("description")} />

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

      <div className="flex items-center gap-3 border-t border-hairline pt-5">
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
