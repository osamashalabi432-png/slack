import { useCallback, useRef } from "react";
import type { Attachment } from "@openslaq/shared";
import { env } from "../env";
import { useAuthProvider } from "../lib/api-client";
import { useGalleryMode } from "../gallery/gallery-context";

/** Where an image lives: the id it is fetched by, and a URL good for now. */
export interface UploadedImage {
  attachmentId: string | null;
  url: string;
}

export interface ImageStore {
  /** Stores one image against a page and says where it went. */
  upload: (file: File, pageId: string) => Promise<UploadedImage | null>;
  /**
   * A URL that works right now for an already-stored image. Download URLs are
   * signed and expire within the hour, so a page body keeps the id and asks
   * for a fresh URL each time it shows the image.
   */
  resolve: (attachmentId: string) => Promise<string | null>;
}

/**
 * Images in a page body go through the same uploads endpoint as message
 * attachments, so they land in the workspace's file store and show up in the
 * files list like anything else. Passing the page along is what lets everyone
 * who can read that page see the image.
 */
export function useImageStore(): ImageStore {
  const isGallery = useGalleryMode();
  const auth = useAuthProvider();
  // The provider is a fresh object every render, so it is held in a ref to
  // keep the returned callbacks stable.
  const authRef = useRef(auth);
  authRef.current = auth;

  const upload = useCallback<ImageStore["upload"]>(
    async (file, pageId) => {
      // The gallery has no backend behind it; a local URL is enough to show
      // the image for the life of the tab.
      if (isGallery) return { attachmentId: null, url: URL.createObjectURL(file) };

      const token = await authRef.current.requireAccessToken();
      const formData = new FormData();
      formData.append("files", file);
      formData.append("pageId", pageId);

      const res = await fetch(`${env.VITE_API_URL}/api/uploads`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Could not upload that image");
      }

      const data = (await res.json()) as { attachments: Attachment[] };
      const attachment = data.attachments[0];
      if (!attachment) return null;
      return { attachmentId: attachment.id as string, url: attachment.downloadUrl };
    },
    [isGallery],
  );

  const resolve = useCallback<ImageStore["resolve"]>(
    async (attachmentId) => {
      if (isGallery) return null;
      const token = await authRef.current.requireAccessToken();
      const res = await fetch(`${env.VITE_API_URL}/api/uploads/${attachmentId}/url`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { downloadUrl: string };
      return data.downloadUrl;
    },
    [isGallery],
  );

  return { upload, resolve };
}
