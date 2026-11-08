"use client";

// "Show your passport to the robot." The camera looks for the QR on a passport picture (or card) and
// hands back the access token it carries. Frames are decoded on this device and never stored or sent.
// Uses the browser's BarcodeDetector when it has one, otherwise jsQR (loaded only when needed).
import { useEffect, useRef, useState } from "react";
import { ScanLine, X } from "lucide-react";
import type { Lang } from "../copy";

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

// A raw token, or a passport card link (the token is the last path segment).
export function tokenFromScan(text: string): string | null {
  const value = text.trim();
  if (TOKEN_RE.test(value)) return value;
  try {
    const last = new URL(value).pathname.split("/").filter(Boolean).pop() ?? "";
    return TOKEN_RE.test(last) ? last : null;
  } catch {
    return null;
  }
}

const COPY = {
  en: {
    title: "Show your passport to the robot",
    hint: "Hold the passport picture (or card) up to the camera so the QR code is in the frame.",
    starting: "Starting the camera…",
    looking: "Looking for the QR code…",
    notPassport: "That QR code is not an HRI Passport. Try the QR on your passport picture.",
    noCamera: "The camera is not available. Allow it in the address bar, or paste the passport link instead.",
    close: "Close",
    privacy: "The camera image stays on this device."
  },
  th: {
    title: "ยกพาสปอร์ตให้หุ่นยนต์ดู",
    hint: "ยกรูปพาสปอร์ต (หรือการ์ด) ให้กล้องเห็น QR ทั้งอัน",
    starting: "กำลังเปิดกล้อง…",
    looking: "กำลังหา QR…",
    notPassport: "QR นี้ไม่ใช่ HRI Passport ลองใช้ QR บนรูปพาสปอร์ตของคุณ",
    noCamera: "ใช้กล้องไม่ได้ อนุญาตกล้องที่แถบที่อยู่ หรือวางลิงก์พาสปอร์ตแทน",
    close: "ปิด",
    privacy: "ภาพจากกล้องอยู่ในเครื่องนี้เท่านั้น"
  }
} as const;

type Detector = { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };

export default function PassportScanner({ lang, onToken, onClose }: { lang: Lang; onToken: (token: string) => void; onClose: () => void }) {
  const c = COPY[lang];
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"starting" | "looking" | "wrong" | "error">("starting");
  const done = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 } }, audio: false });
      } catch {
        if (!stopped) setState("error");
        return;
      }
      const video = videoRef.current;
      if (!video || stopped) return;
      video.srcObject = stream;
      await video.play().catch(() => {});
      setState("looking");

      const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      const native: Detector | null = Native ? new Native({ formats: ["qr_code"] }) : null;
      const jsQR = native ? null : (await import("jsqr")).default;

      const tick = async () => {
        if (stopped || done.current) return;
        let text: string | null = null;
        try {
          if (video.readyState >= 2 && video.videoWidth) {
            if (native) {
              text = (await native.detect(video))[0]?.rawValue ?? null;
            } else if (jsQR && ctx) {
              const scale = Math.min(1, 640 / video.videoWidth);
              canvas.width = Math.round(video.videoWidth * scale);
              canvas.height = Math.round(video.videoHeight * scale);
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
              text = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data ?? null;
            }
          }
        } catch {
          text = null;
        }
        if (text) {
          const token = tokenFromScan(text);
          if (token) {
            done.current = true;
            onToken(token);
            return;
          }
          setState("wrong");
        }
        timer = window.setTimeout(tick, 220);
      };
      tick();
    }
    void start();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
    // Runs once per open; onToken is called at most once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="lab-scan" role="dialog" aria-modal="true" aria-labelledby="lab-scan-title" data-testid="passport-scanner">
      <div className="lab-scan-box">
        <div className="lab-scan-head">
          <h2 id="lab-scan-title"><ScanLine size={18} aria-hidden="true" /> {c.title}</h2>
          <button type="button" className="lab-scan-close" onClick={onClose} aria-label={c.close}><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="lab-scan-view">
          <video ref={videoRef} playsInline muted aria-label={c.title} />
          <span className="lab-scan-frame" aria-hidden="true" />
        </div>
        <p className="lab-scan-hint">{c.hint}</p>
        <p className="lab-scan-state" role="status">
          {state === "starting" ? c.starting : state === "looking" ? c.looking : state === "wrong" ? c.notPassport : c.noCamera}
        </p>
        <p className="lab-scan-privacy">{c.privacy}</p>
      </div>
    </div>
  );
}
