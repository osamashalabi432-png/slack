import { createContext, useContext } from "react";
import type { RemoteControl } from "./useRemoteControl";

/**
 * The screen-share tile sits several layers below the huddle page, and only it
 * needs the control session, so it reads it from context rather than having
 * every grid component forward a dozen props.
 */
export const RemoteControlContext = createContext<RemoteControl | null>(null);

export function useRemoteControlContext(): RemoteControl | null {
  return useContext(RemoteControlContext);
}
