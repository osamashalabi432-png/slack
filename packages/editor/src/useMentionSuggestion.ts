import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MentionSuggestionList, type MentionSuggestionItem, type MentionSuggestionListRef } from "./MentionSuggestion";
import { filterMentionItems } from "./mention-helpers";

export type { MentionSuggestionItem };

export function createMentionSuggestion(
  getMembers: () => MentionSuggestionItem[],
  isActiveRef?: { current: boolean },
  getFiles?: () => MentionSuggestionItem[],
): Omit<SuggestionOptions<MentionSuggestionItem>, "editor"> {
  return {
    items: ({ query }) => filterMentionItems(query, getMembers(), getFiles?.() ?? []),

    // Same as the extension default, but carries the display name into `label`
    // so the chip in the composer reads "@Ada Lovelace" / "@report.pdf" rather
    // than the raw id. The stored markdown still comes from `id` via renderText.
    command: ({ editor, range, props }) => {
      const nodeAfter = editor.view.state.selection.$to.nodeAfter;
      if (nodeAfter?.text?.startsWith(" ")) range.to += 1;
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          { type: "mention", attrs: { id: props.id, label: props.displayName } },
          { type: "text", text: " " },
        ])
        .run();
    },

    render: () => {
      let container: HTMLDivElement | null = null;
      let root: Root | null = null;
      let ref: MentionSuggestionListRef | null = null;

      return {
        onStart: (props: SuggestionProps<MentionSuggestionItem>) => {
          if (isActiveRef) isActiveRef.current = true;
          container = document.createElement("div");
          container.style.position = "fixed";
          container.style.zIndex = "50";

          const { decorationNode } = props;
          if (decorationNode) {
            const rect = (decorationNode as HTMLElement).getBoundingClientRect();
            container.style.left = `${rect.left}px`;
            container.style.bottom = `${window.innerHeight - rect.top + 4}px`;
          }

          document.body.appendChild(container);
          root = createRoot(container);
          root.render(
            createElement(MentionSuggestionList, {
              items: props.items,
              command: props.command,
              ref: (r: MentionSuggestionListRef | null) => {
                ref = r;
              },
            }),
          );
        },

        onUpdate: (props: SuggestionProps<MentionSuggestionItem>) => {
          if (!container || !root) return;

          const { decorationNode } = props;
          if (decorationNode) {
            const rect = (decorationNode as HTMLElement).getBoundingClientRect();
            container.style.left = `${rect.left}px`;
            container.style.bottom = `${window.innerHeight - rect.top + 4}px`;
          }

          root.render(
            createElement(MentionSuggestionList, {
              items: props.items,
              command: props.command,
              ref: (r: MentionSuggestionListRef | null) => {
                ref = r;
              },
            }),
          );
        },

        onKeyDown: (props: { event: KeyboardEvent }) => {
          if (props.event.key === "Escape") {
            if (container) {
              root?.unmount();
              container.remove();
              container = null;
              root = null;
            }
            return true;
          }
          return ref?.onKeyDown(props) ?? false;
        },

        onExit: () => {
          if (isActiveRef) isActiveRef.current = false;
          if (container) {
            root?.unmount();
            container.remove();
            container = null;
            root = null;
          }
        },
      };
    },
  };
}
