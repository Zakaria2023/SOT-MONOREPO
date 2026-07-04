"use server";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { db } from "@/db";
import {
  Categories,
  InsertCategories,
  SelectCategories,
} from "@/db/schema/categories";
import { generateUuid } from "@/lib/helpers";
import {
  cloudflareR2,
  CLOUDFLARE_R2_BUCKET_NAME,
} from "@/lib/server/cloudflare-r2";
import {
  createDocumentObjectKey,
  isAllowedImageType,
  MAX_IMAGE_SIZE_BYTES,
} from "@/lib/server/document-storage";
import { alias } from "drizzle-orm/mysql-core";
import { asc, count, eq, getTableColumns } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CategoryFields = Omit<
  InsertCategories,
  "id" | "uuid" | "createdAt" | "updatedAt"
>;

export type CategoryActionResult = {
  categoryUuid?: string;
  error?: string;
  success?: boolean;
};

export type CategoryListItem = SelectCategories & {
  parentName: SelectCategories["name"] | null;
};

export type UploadCategoryImageResult =
  | { documentId: string; fileName: string }
  | { error: string };

const ParentCategories = alias(Categories, "parent_categories");

export const getCategories = async (): Promise<CategoryListItem[]> => {
  try {
    return await db
      .select({
        ...getTableColumns(Categories),
        parentName: ParentCategories.name,
      })
      .from(Categories)
      .leftJoin(ParentCategories, eq(Categories.parentUuid, ParentCategories.uuid))
      .orderBy(asc(Categories.order));
  } catch {
    throw new Error("Failed to fetch categories");
  }
};

export const getCategory = async (
  uuid: string,
): Promise<SelectCategories | null> => {
  try {
    const [category] = await db
      .select()
      .from(Categories)
      .where(eq(Categories.uuid, uuid));

    return category ?? null;
  } catch {
    throw new Error("Failed to fetch category");
  }
};

export const uploadCategoryImage = async (
  formData: FormData,
): Promise<UploadCategoryImageResult> => {
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return { error: "No file provided" };
  }

  if (!isAllowedImageType(file.type)) {
    return { error: "File type not allowed" };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { error: "File too large" };
  }

  const documentId = generateUuid();

  try {
    const buffer = await file.arrayBuffer();
    await cloudflareR2.send(
      new PutObjectCommand({
        Bucket: CLOUDFLARE_R2_BUCKET_NAME,
        Key: createDocumentObjectKey(documentId),
        Body: Buffer.from(buffer),
        ContentType: file.type,
      }),
    );
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to upload image",
    };
  }

  return { documentId, fileName: file.name };
};

export const createCategory = async (
  _prevState: CategoryActionResult,
  fields: CategoryFields,
): Promise<CategoryActionResult> => {
  const uuid = generateUuid();
  try {
    const [{ total }] = await db.select({ total: count() }).from(Categories);
    await db.insert(Categories).values({ ...fields, uuid, order: total });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to create category",
    };
  }

  revalidatePath("/categories");
  redirect("/categories");
};

export const updateCategory = async (
  uuid: string,
  _prevState: CategoryActionResult,
  fields: CategoryFields,
): Promise<CategoryActionResult> => {
  try {
    await db.update(Categories).set(fields).where(eq(Categories.uuid, uuid));
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update category",
    };
  }

  revalidatePath("/categories");
  redirect("/categories");
};

export const deleteCategory = async (
  uuid: string,
): Promise<CategoryActionResult> => {
  try {
    await db.delete(Categories).where(eq(Categories.uuid, uuid));
    revalidatePath("/categories");
    return { success: true, categoryUuid: uuid };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to delete category",
    };
  }
};
