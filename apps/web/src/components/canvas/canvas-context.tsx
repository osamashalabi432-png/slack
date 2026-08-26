import { createContext, useContext } from "react";

export interface CanvasContextValue {
  workspaceSlug: string;
  channelId: string;
  tabId: string;
  editable: boolean;
}

const CanvasContext = createContext<CanvasContextValue | null>(null);

export const CanvasContextProvider = CanvasContext.Provider;

/**
 * Database node views render inside ProseMirror, outside the normal React
 * tree, so they read channel/workspace identity from this context.
 */
export function useCanvasContext(): CanvasContextValue {
  const ctx = useContext(CanvasContext);
  if (!ctx) throw new Error("useCanvasContext must be used within a CanvasContextProvider");
  return ctx;
}
