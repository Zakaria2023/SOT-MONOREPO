"use client";

import { ImagePlus, Send, X } from "lucide-react";
import Image from "next/image";
import { useRef } from "react";
import type { ChangeEvent } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Input } from "ui";
import type { useAttachedImages } from "@/app/assistant/use-attached-images";
import type { ChatMessageFormValues } from "@/app/assistant/validation";

type AttachedImagesController = ReturnType<typeof useAttachedImages>;

type ChatInputFormProps = {
  form: UseFormReturn<ChatMessageFormValues>;
  onSubmit: () => void;
  isPending: boolean;
  attachments: AttachedImagesController;
};

export const ChatInputForm = ({
  form,
  onSubmit,
  isPending,
  attachments,
}: ChatInputFormProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) attachments.addFiles(event.target.files);
    event.target.value = "";
  };

  return (
    <div className="border-t border-hairline bg-surface p-3">
      {attachments.images.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.images.map((image) => (
            <div key={image.id} className="relative h-14 w-14 shrink-0">
              <Image
                src={image.dataUrl}
                alt={image.name}
                width={56}
                height={56}
                className="h-14 w-14 rounded-control border border-hairline object-cover"
              />
              <button
                type="button"
                onClick={() => attachments.removeImage(image.id)}
                aria-label={`Remove ${image.name}`}
                className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {attachments.error ? (
        <p className="mb-1.5 text-xs text-danger">{attachments.error}</p>
      ) : null}

      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFilesSelected}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isPending}
          aria-label="Attach photos"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-control border border-hairline text-secondary hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ImagePlus size={18} />
        </button>

        <div className="flex-1">
          <Input
            {...form.register("message")}
            type="text"
            autoComplete="off"
            placeholder="Ask about our products..."
            disabled={isPending}
            error={form.formState.errors.message?.message}
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          aria-label="Send message"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-control bg-primary text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};
