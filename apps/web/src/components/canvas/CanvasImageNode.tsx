import { createContext, useContext, useEffect, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { ImageOff, Loader2, X } from "lucide-react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    canvasImage: {
      /** Drops an image into the document. */
      insertCanvasImage: (attrs: {
        src: string;
        attachmentId?: string | null;
        alt?: string;
      }) => ReturnType;
      /** A placeholder held while the file uploads, replaced when it lands. */
      insertUploadingImage: (uploadId: string) => ReturnType;
    };
  }
}

/**
 * Turns a stored image into a URL that works right now.
 *
 * Download URLs are signed and expire, so the document keeps the attachment id
 * and the picture is looked up whenever it is shown.
 */
const ImageSourceContext = createContext<((attachmentId: string) => Promise<string | null>) | null>(
  null,
);

export function ImageSourceProvider({
  resolve,
  children,
}: {
  resolve: (attachmentId: string) => Promise<string | null>;
  children: React.ReactNode;
}) {
  return <ImageSourceContext.Provider value={resolve}>{children}</ImageSourceContext.Provider>;
}

/** The URL to show, given what the document stored about the image. */
function useImageSrc(attachmentId: string | null, storedSrc: string | null): string | null {
  const resolve = useContext(ImageSourceContext);
  // The stored URL shows the image straight after a paste, before a fresh one
  // has been fetched; after a reload it has usually expired.
  const [src, setSrc] = useState<string | null>(storedSrc);

  useEffect(() => {
    if (!attachmentId || !resolve) return;
    let cancelled = false;
    void resolve(attachmentId).then((fresh) => {
      if (!cancelled && fresh) setSrc(fresh);
    });
    return () => {
      cancelled = true;
    };
  }, [attachmentId, resolve]);

  return src;
}

function ImageView({ node, deleteNode, editor }: NodeViewProps) {
  const attachmentId = (node.attrs.attachmentId as string | null) ?? null;
  const stored = (node.attrs.src as string | null) ?? null;
  const alt = (node.attrs.alt as string | null) ?? "";
  const src = useImageSrc(attachmentId, stored);
  const uploading = Boolean(node.attrs.uploadId) && !stored;

  return (
    <NodeViewWrapper
      className="canvas-image-node my-2"
      data-drag-handle
      contentEditable={false}
      suppressContentEditableWarning
    >
      {uploading ? (
        <div
          data-testid="canvas-image-uploading"
          className="flex items-center gap-2 px-3 py-6 rounded-lg border border-dashed border-border-default text-sm text-muted"
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          Uploading image…
        </div>
      ) : src ? (
        <div className="group relative inline-block max-w-full">
          <img
            src={src}
            alt={alt}
            data-testid="canvas-image"
            data-attachment-id={attachmentId ?? undefined}
            className="max-w-full rounded-lg block"
          />
          {editor.isEditable && (
            <button
              type="button"
              aria-label="Remove image"
              data-testid="canvas-image-remove"
              onClick={() => deleteNode()}
              className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 w-7 h-7 rounded bg-black/60 text-white flex items-center justify-center border-none cursor-pointer transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div
          data-testid="canvas-image-failed"
          className="flex items-center gap-2 px-3 py-6 rounded-lg border border-dashed border-border-default text-sm text-muted"
        >
          <ImageOff className="w-4 h-4" />
          This image could not be loaded.
        </div>
      )}
    </NodeViewWrapper>
  );
}

/**
 * An image sitting in the document, between the lines like any other block.
 *
 * While a file is uploading the node carries an `uploadId` and no `src`, so the
 * placeholder can be found and swapped for the real image once the upload
 * finishes — without disturbing whatever has been typed in the meantime.
 */
export const CanvasImageNode = Node.create({
  name: "canvasImage",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => element.getAttribute("src"),
        renderHTML: (attributes) => (attributes.src ? { src: attributes.src as string } : {}),
      },
      alt: {
        default: null,
        parseHTML: (element) => element.getAttribute("alt"),
        renderHTML: (attributes) => (attributes.alt ? { alt: attributes.alt as string } : {}),
      },
      attachmentId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-attachment-id"),
        renderHTML: (attributes) =>
          attributes.attachmentId
            ? { "data-attachment-id": attributes.attachmentId as string }
            : {},
      },
      uploadId: {
        default: null,
        // Transient: a half-finished upload should never be written to the
        // document, so it is not serialised.
        rendered: false,
      },
    };
  },

  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes)];
  },

  addCommands() {
    return {
      insertCanvasImage:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
      insertUploadingImage:
        (uploadId: string) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { uploadId } }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});
