"use client";

import { ImageOff, ImagePlus, Loader2 } from "lucide-react";
import Image from "next/image";
import type { ChangeEvent, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { Button } from "./button";
import { FormError } from "./form-error";

type ImageUploadProps = {
  label?: string;
  register: UseFormRegisterReturn;
  onUploaded: (documentId: string) => void;
  onUploadingChange?: (isUploading: boolean) => void;
  previewUrl?: string | null;
  submittedRef?: RefObject<boolean>;
  accept?: string;
};

export const ImageUpload = ({
  label,
  register,
  onUploaded,
  onUploadingChange,
  previewUrl,
  submittedRef,
  accept = "image/png,image/jpeg,image/webp",
}: ImageUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadedDocumentIdRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<string | null>(previewUrl ?? null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      const documentId = uploadedDocumentIdRef.current;
      if (documentId && !submittedRef?.current) {
        fetch(`/api/documents/${documentId}/delete`, {
          method: "DELETE",
        }).catch(() => {});
      }
    },
    [submittedRef],
  );

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setIsUploading(true);
    onUploadingChange?.(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      const result: { documentId: string; fileName: string } | { error: string } =
        await response.json();

      if (!response.ok || "error" in result) {
        setError("error" in result ? result.error : "Failed to upload image");
        setFileName(null);
      } else {
        setFileName(result.fileName);
        uploadedDocumentIdRef.current = result.documentId;
        onUploaded(result.documentId);
      }
    } catch {
      setError("Failed to upload image");
      setFileName(null);
    }

    setIsUploading(false);
    onUploadingChange?.(false);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-semibold text-ink">{label}</label>
      )}

      <input type="hidden" {...register} />
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex items-center gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-control border border-hairline bg-hover">
          {preview ? (
            <Image
              src={preview}
              alt="Preview"
              fill
              unoptimized
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-faint">
              <ImageOff size={18} />
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 size={16} className="animate-spin text-faint" />
          ) : (
            <ImagePlus size={16} className="text-faint" />
          )}
          {fileName ?? (preview ? "Replace image" : "Choose an image")}
        </Button>
      </div>

      <FormError message={error ?? undefined} />
    </div>
  );
};
