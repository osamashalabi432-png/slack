import { MousePointer2, ShieldAlert } from "lucide-react";
import type { RemoteControl } from "./useRemoteControl";

/**
 * The sharer's side of remote control: the consent prompt, and the banner that
 * stays up for as long as someone else is driving, with revoking one click
 * away at all times.
 */
export function RemoteControlPrompt({
  control,
  nameFor,
}: {
  control: RemoteControl;
  nameFor: (identity: string) => string;
}) {
  if (control.pendingRequest) {
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60">
        <div
          className="bg-slate-800 rounded-xl p-6 max-w-sm mx-4 shadow-2xl text-white"
          data-testid="remote-control-prompt"
        >
          <div className="flex items-start gap-3 mb-3">
            <ShieldAlert className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-semibold">
                {nameFor(control.pendingRequest)} wants to control your screen
              </h3>
              <p className="text-sm text-white/60 mt-1">
                They will be able to move your mouse and type on this computer until you stop it.
                You can take control back at any time.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={control.deny}
              data-testid="remote-control-deny"
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium border-none cursor-pointer"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={control.approve}
              data-testid="remote-control-approve"
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-sm font-semibold border-none cursor-pointer"
            >
              Allow control
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (control.controlledBy) {
    return (
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30">
        <div
          className="flex items-center gap-2 px-3 h-9 rounded-full bg-emerald-500 text-slate-900 text-xs font-semibold shadow-lg"
          data-testid="remote-control-active-banner"
        >
          <MousePointer2 className="w-4 h-4" />
          {nameFor(control.controlledBy)} is controlling your screen
          <button
            type="button"
            onClick={control.revoke}
            data-testid="remote-control-revoke"
            className="ml-1 px-2 py-1 rounded bg-slate-900/85 hover:bg-slate-900 text-white text-[11px] border-none cursor-pointer"
          >
            Stop
          </button>
        </div>
      </div>
    );
  }

  return null;
}
