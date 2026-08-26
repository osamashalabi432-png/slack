import { useEffect, useState } from "react";

export interface MediaDeviceLists {
  audioInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
}

const EMPTY: MediaDeviceLists = { audioInputs: [], audioOutputs: [], videoInputs: [] };

/**
 * Device labels stay blank until the user grants permission, and headsets get
 * plugged in mid-call, so re-enumerate whenever the browser says so.
 */
export function useMediaDevices(): MediaDeviceLists {
  const [devices, setDevices] = useState<MediaDeviceLists>(EMPTY);

  useEffect(() => {
    const media = navigator.mediaDevices;
    if (!media?.enumerateDevices) return;

    let cancelled = false;
    const load = () => {
      media.enumerateDevices().then((all) => {
        if (cancelled) return;
        setDevices({
          audioInputs: all.filter((d) => d.kind === "audioinput"),
          audioOutputs: all.filter((d) => d.kind === "audiooutput"),
          videoInputs: all.filter((d) => d.kind === "videoinput"),
        });
      }).catch(() => {
        // Enumeration can fail in locked-down contexts; an empty list is fine.
      });
    };

    load();
    media.addEventListener?.("devicechange", load);
    return () => {
      cancelled = true;
      media.removeEventListener?.("devicechange", load);
    };
  }, []);

  return devices;
}

export function deviceLabel(device: MediaDeviceInfo, fallback: string): string {
  return device.label || `${fallback} ${device.deviceId.slice(0, 6)}`;
}
