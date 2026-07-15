"use client";

import { useCallback, useState } from "react";
import { MAX_ATTACHMENTS, MAX_ATTACHMENT_SOURCE_BYTES } from "./validation";
import type { ChatAttachment } from "./validation";

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.82;

const generateId = () => Math.random().toString(36).slice(2);

const downscaleToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Canvas is not supported in this browser"));
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read that image"));
    };

    img.src = objectUrl;
  });

export const useAttachedImages = () => {
  const [images, setImages] = useState<ChatAttachment[]>([]);
  const [error, setError] = useState<string>();

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const incoming = Array.from(files).filter((file) => file.type.startsWith("image/"));

      if (incoming.length === 0) {
        setError("Only image files are supported");
        return;
      }

      const room = MAX_ATTACHMENTS - images.length;
      if (room <= 0) {
        setError(`You can attach up to ${MAX_ATTACHMENTS} photos`);
        return;
      }

      const oversized = incoming.find((file) => file.size > MAX_ATTACHMENT_SOURCE_BYTES);
      if (oversized) {
        setError(`${oversized.name} is too large (max 8MB)`);
        return;
      }

      setError(undefined);
      const accepted = incoming.slice(0, room);

      try {
        const processed = await Promise.all(
          accepted.map(async (file) => ({
            id: generateId(),
            name: file.name,
            dataUrl: await downscaleToDataUrl(file),
          })),
        );
        setImages((prev) => [...prev, ...processed]);
      } catch {
        setError("Could not process one of those images — try a different file.");
      }
    },
    [images.length],
  );

  const removeImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((image) => image.id !== id));
  }, []);

  const clear = useCallback(() => {
    setImages([]);
    setError(undefined);
  }, []);

  return { images, error, addFiles, removeImage, clear };
};
