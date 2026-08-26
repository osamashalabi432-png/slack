import { isTauri } from "./tauri";

/**
 * Input the controlling participant sends to whoever is sharing their screen.
 * Coordinates are fractions of the shared picture so they survive whatever
 * resolution each side is running.
 */
export type ControlEvent =
  | { kind: "move"; x: number; y: number }
  | { kind: "button"; button: "left" | "right" | "middle"; down: boolean }
  | { kind: "scroll"; dx: number; dy: number }
  | { kind: "key"; key: string; down: boolean }
  | { kind: "text"; text: string };

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!isTauri()) return null;
  const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
  return tauriInvoke<T>(command, args);
}

/**
 * Arms or disarms input injection. The Rust side checks this on every event,
 * so revoking takes effect even if messages are still in flight.
 */
export async function setRemoteControlEnabled(enabled: boolean): Promise<void> {
  await invoke("remote_control_set_enabled", { enabled });
}

export async function applyRemoteControl(events: ControlEvent[]): Promise<void> {
  if (events.length === 0) return;
  await invoke("remote_control_input", { events });
}

/** Only the desktop app can be driven; the browser has no way to inject input. */
export function canBeControlled(): boolean {
  return isTauri();
}
