"use server";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { db } from "@/db";
import { Brands, InsertBrands, SelectBrands } from "@/db/schema/brands";
import { generateUuid } from "@/lib/helpers";
import {
  cloudflareR2,
  CLOUDFLARE_R2_BUCKET_NAME,
} from "@/lib/server/cloudflare-r2";
import {
  createDocumentDownloadUrl,
  createDocumentObjectKey,
  isAllowedImageType,
  MAX_IMAGE_SIZE_BYTES,
} from "@/lib/server/document-storage";
import { asc, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type BrandFields = Omit<
  InsertBrands,
  "id" | "uuid" | "createdAt" | "updatedAt"
>;

export type BrandActionResult = {
  brandUuid?: string;
  error?: string;
  success?: boolean;
};

export type BrandDetail = SelectBrands & {
  imageUrl: string | null;
};

export type UploadBrandImageResult =
  | { documentId: string; fileName: string }
  | { error: string };

export const getBrands = async (): Promise<SelectBrands[]> => {
  try {
    return await db.select().from(Brands).orderBy(asc(Brands.order));
  } catch {
    throw new Error("Failed to fetch brands");
  }
};

export const getBrand = async (uuid: string): Promise<BrandDetail | null> => {
  try {
    const [brand] = await db.select().from(Brands).where(eq(Brands.uuid, uuid));

    if (!brand) return null;

    return {
      ...brand,
      imageUrl: brand.image
        ? await createDocumentDownloadUrl({
            documentId: brand.image,
            fileName: brand.name,
          })
        : null,
    };
  } catch {
    throw new Error("Failed to fetch brand");
  }
};

export const uploadBrandImage = async (
  formData: FormData,
): Promise<UploadBrandImageResult> => {
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

export const createBrand = async (
  _prevState: BrandActionResult,
  fields: BrandFields,
): Promise<BrandActionResult> => {
  const uuid = generateUuid();
  try {
    const [{ total }] = await db.select({ total: count() }).from(Brands);
    await db.insert(Brands).values({ ...fields, uuid, order: total });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to create brand",
    };
  }

  revalidatePath("/brands");
  redirect("/brands");
};

export const updateBrand = async (
  uuid: string,
  _prevState: BrandActionResult,
  fields: BrandFields,
): Promise<BrandActionResult> => {
  try {
    await db.update(Brands).set(fields).where(eq(Brands.uuid, uuid));
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to update brand",
    };
  }

  revalidatePath("/brands");
  redirect("/brands");
};

export const deleteBrand = async (
  uuid: string,
): Promise<BrandActionResult> => {
  try {
    await db.delete(Brands).where(eq(Brands.uuid, uuid));
    revalidatePath("/brands");
    return { success: true, brandUuid: uuid };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to delete brand",
    };
  }
};
