"use client";

import { ImagePlus, Loader2 } from "lucide-react";
import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

export type ImageUploadResult =
  | { documentId: string; fileName: string }
  | { error: string };

type ImageUploadProps = {
  label?: string;
  register: UseFormRegisterReturn;
  onUploaded: (documentId: string) => void;
  upload: (formData: FormData) => Promise<ImageUploadResult>;
  onUploadingChange?: (isUploading: boolean) => void;
  accept?: string;
};

export const ImageUpload = ({
  label,
  register,
  onUploaded,
  upload,
  onUploadingChange,
  accept = "image/png,image/jpeg,image/webp",
}: ImageUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    onUploadingChange?.(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    const result = await upload(formData);

    if ("error" in result) {
      setError(result.error);
      setFileName(null);
    } else {
      setFileName(result.fileName);
      onUploaded(result.documentId);
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
        {fileName ?? "Choose an image"}
      </Button>

      <FormError message={error ?? undefined} />
    </div>
  );
};
