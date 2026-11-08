"use client";

// Watches a live <video> for an HRI Passport QR code, on this device. Uses the browser's BarcodeDetector
// when it has one, otherwise jsQR (loaded only when needed). Frames are never stored or sent.
import { useEffect, useRef, type RefObject } from "react";
import { tokenFromScan } from "./PassportScanner";

type Detector = { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };

// Calls `onToken` with each passport token seen; the same token again only after `repeatMs`.
export function useQrWatch(video: RefObject<HTMLVideoElement | null>, enabled: boolean, onToken: (token: string) => void, repeatMs = 15_000) {
  const handler = useRef(onToken);
  handler.current = onToken;
  const last = useRef<{ token: string; at: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      let native: Detector | null = null;
      try { native = Native ? new Native({ formats: ["qr_code"] }) : null; } catch { native = null; }
      const jsQR = native ? null : (await import("jsqr")).default;

      const tick = async () => {
        if (stopped) return;
        const el = video.current;
        let text: string | null = null;
        try {
          if (el && el.readyState >= 2 && el.videoWidth) {
            if (native) {
              text = (await native.detect(el))[0]?.rawValue ?? null;
            } else if (jsQR && ctx) {
              const scale = Math.min(1, 640 / el.videoWidth);
              canvas.width = Math.round(el.videoWidth * scale);
              canvas.height = Math.round(el.videoHeight * scale);
              ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
              const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
              text = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data ?? null;
            }
          }
        } catch {
          text = null;
        }
        const token = text ? tokenFromScan(text) : null;
        if (token) {
          const now = Date.now();
          const seen = last.current;
          if (!seen || seen.token !== token || now - seen.at > repeatMs) {
            last.current = { token, at: now };
            handler.current(token);
          }
        }
        if (!stopped) timer = window.setTimeout(tick, 350);
      };
      tick();
    })();
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [enabled, video, repeatMs]);
}
