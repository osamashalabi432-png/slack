import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, ImagePlus, Smile, Star, Trash2, X } from "lucide-react";
import type { CanvasContent, DatabasePreset, PageDetail } from "@openslaq/shared";
import { pageTitle, UNTITLED_PAGE } from "@openslaq/shared";
import { CanvasEditor } from "../canvas/CanvasEditor";
import { PageLinkProvider } from "../canvas/PageLinkNode";
import { colorFromId } from "../canvas/collab-caret";
import { PageIconPicker } from "./PageIconPicker";
import type { PageActions } from "../../hooks/chat/usePages";
import { useConfirm } from "../ui";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useImageStore } from "../../hooks/useImageStore";
import { ImageSourceProvider } from "../canvas/CanvasImageNode";

interface PageViewProps {
  pageId: string;
  actions: PageActions;
  onOpenPage: (pageId: string) => void;
  onClosePage: () => void;
  /** Supplied inside a channel, where database blocks have a channel to live in. */
  onCreateDatabase?: (preset: DatabasePreset) => Promise<string | null>;
}


/**
 * A page: cover, icon, title, then the body. The title is a plain input rather
 * than the first line of the document, so renaming from the tree and renaming
 * here cannot disagree.
 */
export function PageView({
  pageId,
  actions,
  onOpenPage,
  onClosePage,
  onCreateDatabase,
}: PageViewProps) {
  const { get, update, favourite: favouritePage, archive, create, pages } = actions;
  const images = useImageStore();
  const me = useCurrentUser();
  const collabUser = useMemo(
    () =>
      me?.id
        ? {
            id: me.id,
            name: me.displayName || me.primaryEmail || "You",
            color: colorFromId(me.id),
            avatarUrl: me.profileImageUrl ?? null,
          }
        : null,
    [me?.id, me?.displayName, me?.primaryEmail, me?.profileImageUrl],
  );
  const [page, setPage] = useState<PageDetail | null>(null);
  const [title, setTitle] = useState("");
  const [iconOpen, setIconOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  // Renaming shouldn't hit the server on every keystroke.
  const renameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iconButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    setPage(null);
    setError(null);
    get(pageId)
      .then((detail) => {
        if (cancelled) return;
        setPage(detail);
        setTitle(detail.title === UNTITLED_PAGE ? "" : detail.title);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not open this page");
        }
      });
    return () => {
      cancelled = true;
    };
    // Only the page id may re-trigger this: a reload mid-edit must not
    // replace what is being typed.
  }, [get, pageId]);

  useEffect(() => {
    return () => {
      if (renameTimer.current) clearTimeout(renameTimer.current);
    };
  }, []);

  const rename = useCallback(
    (next: string) => {
      setTitle(next);
      if (renameTimer.current) clearTimeout(renameTimer.current);
      renameTimer.current = setTimeout(() => {
        void update(pageId, { title: next });
      }, 500);
    },
    [update, pageId],
  );

  // Persist a metadata change and reflect it locally at once — otherwise the
  // icon / cover only appears after the next mount (a refresh or a tab bounce).
  const patchMeta = useCallback(
    (patch: { icon?: string | null; coverUrl?: string | null }) => {
      setPage((p) => (p ? { ...p, ...patch } : p));
      void update(pageId, patch);
    },
    [update, pageId],
  );

  // Images belong to the page they were dropped into, so everyone who can read
  // the page can see them.
  const uploadImage = useCallback(
    (file: File) => images.upload(file, pageId),
    [images, pageId],
  );

  const saveBody = useCallback(
    async (content: CanvasContent) => update(pageId, { content }),
    [update, pageId],
  );

  // "/page" mints a child of this page and hands its id back, so the editor
  // can drop a link to it where the cursor is.
  const createSubPage = useCallback(async () => {
    const child = await create(pageId);
    return child.id as string;
  }, [create, pageId]);

  // Titles are read live from the tree rather than copied into the body, so a
  // rename updates every link pointing at that page.
  const pageLinks = useMemo(
    () => ({
      lookup: (id: string) => {
        const found = pages.find((candidate) => (candidate.id as string) === id);
        return found ? { title: found.title, icon: found.icon } : undefined;
      },
      open: onOpenPage,
    }),
    [pages, onOpenPage],
  );

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8" data-testid="page-error">
        <p className="text-sm text-danger-text">{error}</p>
      </div>
    );
  }

  if (!page) {
    return <div className="flex-1" data-testid="page-loading" />;
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-y-auto" data-testid="page-view">
      {page.coverUrl && (
        <div className="relative h-40 shrink-0">
          <img src={page.coverUrl} alt="" className="w-full h-full object-cover" />
          <button
            type="button"
            aria-label="Remove cover"
            data-testid="page-cover-remove"
            onClick={() => patchMeta({ coverUrl: null })}
            className="absolute top-2 right-2 w-7 h-7 rounded bg-black/50 text-white flex items-center justify-center border-none cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="px-14 pt-4 pb-2 shrink-0">
        <nav className="flex items-center gap-1 text-xs text-muted mb-3" data-testid="page-breadcrumbs">
          {page.breadcrumbs.map((crumb) => {
            const live = pageLinks.lookup(crumb.id as string);
            return (
              <span key={crumb.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onOpenPage(crumb.id as string)}
                  data-testid={`page-crumb-${crumb.id}`}
                  className="hover:text-primary bg-transparent border-none cursor-pointer p-0 text-xs"
                >
                  {(live?.icon ?? crumb.icon) ? `${live?.icon ?? crumb.icon} ` : ""}
                  {pageTitle(live?.title ?? crumb.title)}
                </button>
                <ChevronRight className="w-3 h-3" />
              </span>
            );
          })}
          <span className="text-secondary">{pageTitle(title || page.title)}</span>
        </nav>

        <div className="flex items-center gap-2 mb-2">
          <div className="relative">
            <button
              ref={iconButtonRef}
              type="button"
              onClick={() => setIconOpen((v) => !v)}
              data-testid="page-icon-button"
              className="w-10 h-10 rounded-lg flex items-center justify-center text-2xl bg-transparent hover:bg-surface-hover border-none cursor-pointer"
            >
              {page.icon ?? <Smile className="w-6 h-6 text-muted" />}
            </button>
            {iconOpen && (
              <PageIconPicker
                anchorRef={iconButtonRef}
                onSelect={(emoji) => {
                  setIconOpen(false);
                  patchMeta({ icon: emoji });
                }}
                onRemove={() => {
                  setIconOpen(false);
                  patchMeta({ icon: null });
                }}
                onClose={() => setIconOpen(false)}
              />
            )}
          </div>

          <input
            value={title}
            onChange={(e) => rename(e.target.value)}
            placeholder={UNTITLED_PAGE}
            data-testid="page-title-input"
            className="flex-1 text-3xl font-bold text-primary bg-transparent border-none outline-none placeholder:text-muted"
          />

          <button
            type="button"
            aria-label={page.isFavourite ? "Unstar page" : "Star page"}
            data-testid="page-favourite"
            onClick={() => void favouritePage(pageId, !page.isFavourite)}
            className="w-8 h-8 flex items-center justify-center rounded bg-transparent hover:bg-surface-hover border-none cursor-pointer"
          >
            <Star
              className={page.isFavourite ? "w-4 h-4 text-amber-400 fill-amber-400" : "w-4 h-4 text-muted"}
            />
          </button>

          {!page.coverUrl && (
            <button
              type="button"
              aria-label="Add cover"
              data-testid="page-cover-add"
              onClick={() => {
                const url = window.prompt("Cover image URL");
                if (url) patchMeta({ coverUrl: url });
              }}
              className="w-8 h-8 flex items-center justify-center rounded bg-transparent hover:bg-surface-hover border-none cursor-pointer text-muted"
            >
              <ImagePlus className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            aria-label="Archive page"
            data-testid="page-archive"
            onClick={async () => {
              const ok = await confirm({
                title: `Archive ${pageTitle(page.title)}?`,
                description:
                  "It and every page inside it leave the sidebar. Nothing is deleted — you can restore it.",
                confirmLabel: "Archive",
              });
              if (ok) {
                await archive(pageId, true);
                onClosePage();
              }
            }}
            className="w-8 h-8 flex items-center justify-center rounded bg-transparent hover:bg-surface-hover border-none cursor-pointer text-muted"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 px-14 pb-10">
        <PageLinkProvider value={pageLinks}>
          <ImageSourceProvider resolve={images.resolve}>
            <CanvasEditor
              documentKey={pageId}
              initialContent={page.content}
              onSave={saveBody}
              onCreatePage={createSubPage}
              onCreateDatabase={onCreateDatabase}
              onUploadImage={uploadImage}
              collabUser={collabUser}
              editable
            />
          </ImageSourceProvider>
        </PageLinkProvider>
      </div>

      {dialog}
    </div>
  );
}
