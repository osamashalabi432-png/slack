import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { FileText } from "lucide-react";
import { createContext, useContext } from "react";
import { pageTitle } from "@openslaq/shared";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pageLink: {
      /** Drops a link to an existing sub-page into the document. */
      insertPageLink: (pageId: string) => ReturnType;
    };
  }
}

export interface PageLinkContextValue {
  /** Title and icon for a page, so the block can label itself. */
  lookup: (pageId: string) => { title: string; icon: string | null } | undefined;
  open: (pageId: string) => void;
}

const PageLinkContext = createContext<PageLinkContextValue | null>(null);
export const PageLinkProvider = PageLinkContext.Provider;

function usePageLinkContext(): PageLinkContextValue | null {
  return useContext(PageLinkContext);
}

function PageLinkView({ node }: NodeViewProps) {
  const pageId = node.attrs.pageId as string | null;
  const ctx = usePageLinkContext();
  const page = pageId ? ctx?.lookup(pageId) : undefined;

  return (
    <NodeViewWrapper
      className="page-link-node"
      data-drag-handle
      contentEditable={false}
      suppressContentEditableWarning
    >
      <button
        type="button"
        disabled={!pageId}
        data-testid={pageId ? `page-link-${pageId}` : "page-link-broken"}
        onClick={() => pageId && ctx?.open(pageId)}
        className="flex items-center gap-2 w-full text-left px-1 py-1 my-0.5 rounded-md bg-transparent border-none cursor-pointer hover:bg-surface-hover"
      >
        <span className="w-5 shrink-0 text-center leading-none">
          {page?.icon ?? <FileText className="w-4 h-4 inline text-muted" />}
        </span>
        <span className="font-semibold text-primary underline decoration-border-strong underline-offset-4">
          {/* The title is read live rather than copied into the document, so
              renaming a page updates every link to it. */}
          {page ? pageTitle(page.title) : "Untitled"}
        </span>
      </button>
    </NodeViewWrapper>
  );
}

/**
 * A sub-page sitting inside the document, the way Notion shows one: an icon
 * and the page's name, and clicking it opens that page. Only the id is stored
 * in the body — the title lives on the page itself.
 */
export const PageLinkNode = Node.create({
  name: "pageLink",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      pageId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-page-id"),
        renderHTML: (attributes) => {
          if (!attributes.pageId) return {};
          return { "data-page-id": attributes.pageId as string };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-page-link]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-page-link": "" })];
  },

  addCommands() {
    return {
      insertPageLink:
        (pageId: string) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { pageId } }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageLinkView);
  },
});
