"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import Image from "next/image";
import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import { Button } from "./button";
import { FormError } from "./form-error";

type MultiImageUploadProps = {
  label?: string;
  value: string[];
  onChange: (documentIds: string[]) => void;
  getPreviewUrl: (documentId: string) => string;
  onUploadingChange?: (isUploading: boolean) => void;
  accept?: string;
};

export const MultiImageUpload = ({
  label,
  value,
  onChange,
  getPreviewUrl,
  onUploadingChange,
  accept = "image/png,image/jpeg,image/webp",
}: MultiImageUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewFor = (documentId: string) =>
    previews[documentId] ?? getPreviewUrl(documentId);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setIsUploading(true);
    onUploadingChange?.(true);
    setError(null);

    const uploaded: string[] = [];
    const nextPreviews: Record<string, string> = {};

    for (const file of Array.from(files)) {
      const objectUrl = URL.createObjectURL(file);
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });
        const result:
          { documentId: string; fileName: string } | { error: string } =
          await response.json();

        if (!response.ok || "error" in result) {
          setError("error" in result ? result.error : "Failed to upload image");
        } else {
          uploaded.push(result.documentId);
          nextPreviews[result.documentId] = objectUrl;
        }
      } catch {
        setError("Failed to upload image");
      }
    }

    if (uploaded.length > 0) {
      setPreviews((current) => ({ ...current, ...nextPreviews }));
      onChange([...value, ...uploaded]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setIsUploading(false);
    onUploadingChange?.(false);
  };

  const removeImage = (documentId: string) =>
    onChange(value.filter((id) => id !== documentId));

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-semibold text-ink">{label}</label>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex flex-wrap items-center gap-3">
        {value.map((documentId) => (
          <div
            key={documentId}
            // Same size and fit as the main image plate, one step smaller: these
            // are a gallery, and a cropped 64px square told the admin nothing
            // about which shot they were looking at.
            className="relative h-32 w-32 shrink-0 overflow-hidden rounded-control border border-hairline bg-hover"
          >
            <Image
              src={previewFor(documentId)}
              alt="Sub image"
              fill
              sizes="128px"
              // See image-upload: a blob: URL from the local file picker cannot
              // be optimized, a stored document can.
              unoptimized={previewFor(documentId).startsWith("blob:")}
              className="object-contain p-2"
            />
            <button
              type="button"
              onClick={() => removeImage(documentId)}
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink/70 text-white transition-colors hover:bg-ink"
              aria-label="Remove image"
            >
              <X size={12} />
            </button>
          </div>
        ))}

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
          Add images
        </Button>
      </div>

      <FormError message={error ?? undefined} />
    </div>
  );
};
