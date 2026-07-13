"use client";

import { uploadCertificate } from "@/app/sign-up/actions";
import { FileCheck2, Loader2, Upload } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { FormError } from "ui";

type CertificateUploadProps = {
  label: string;
  value: string;
  onChange: (documentId: string) => void;
  error?: string;
};

// Uploads a PDF/image via the uploadCertificate Server Action and hands the
// returned document id back to the form. Used for the facility CR / VAT certs.
export const CertificateUpload = ({
  label,
  value,
  onChange,
  error,
}: CertificateUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    setUploadError(undefined);

    try {
      const body = new FormData();
      body.append("file", file);
      const result = await uploadCertificate(body);

      if (result.error || !result.documentId) {
        setUploadError(result.error ?? "Upload failed. Try again.");
        return;
      }

      onChange(result.documentId);
      setFileName(result.fileName ?? file.name);
    } catch {
      setUploadError("Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-ink">{label}</span>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 rounded-control border border-search-border bg-surface px-3.5 py-2.5 text-sm text-muted transition-colors hover:border-primary disabled:opacity-60"
      >
        {uploading ? (
          <Loader2 size={16} className="animate-spin text-primary" />
        ) : value ? (
          <FileCheck2 size={16} className="text-primary" />
        ) : (
          <Upload size={16} className="text-faint" />
        )}
        <span className="line-clamp-1">
          {uploading
            ? "Uploading…"
            : value
              ? fileName || "Certificate uploaded"
              : "Upload PDF or image"}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/*"
        className="hidden"
        onChange={handleFile}
      />

      <FormError message={error ?? uploadError} />
    </div>
  );
};
