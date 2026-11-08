"use client";

// "Keep your passport as a picture." On a computer: a QR to scan with the phone (it opens the card with
// ?save=1, where the phone saves the picture) and a direct PNG download. On the phone itself: the picture
// to long-press or share. The picture's own QR is what a robot scans later.
import { useEffect, useState } from "react";
import { Download, ImageDown, QrCode } from "lucide-react";
import QRCode from "qrcode";
import type { Lang } from "../copy";
import { renderPassportPng, savePassportPng, type PassportImageData } from "./passport-image";

const COPY = {
  en: {
    title: "Keep your passport as a picture",
    body: "Save it to your phone. When you meet a robot, show it the picture: the robot scans the QR on it and reads your preferences.",
    scan: "Scan with your phone to save the picture",
    download: "Download picture (PNG)",
    saving: "Making the picture…",
    saved: "Saved.",
    shared: "Done.",
    failed: "The picture could not be made in this browser. The card link still works.",
    phone: "Press and hold the picture to save it, or use the button.",
    save: "Save picture"
  },
  th: {
    title: "เก็บพาสปอร์ตไว้เป็นรูปภาพ",
    body: "บันทึกรูปไว้ในมือถือ เวลาเจอหุ่นยนต์ก็ยกรูปให้หุ่นดู หุ่นจะสแกน QR บนรูปแล้วอ่านความชอบของคุณ",
    scan: "สแกนด้วยมือถือเพื่อบันทึกรูปลงเครื่อง",
    download: "ดาวน์โหลดรูป (PNG)",
    saving: "กำลังสร้างรูป…",
    saved: "บันทึกแล้ว",
    shared: "เรียบร้อย",
    failed: "เบราว์เซอร์นี้สร้างรูปไม่ได้ ลิงก์การ์ดยังใช้ได้ตามปกติ",
    phone: "กดค้างที่รูปเพื่อบันทึก หรือกดปุ่มด้านล่าง",
    save: "บันทึกรูป"
  }
} as const;

export default function PassportSave({ lang, data, saveUrl, onPhone = false }: {
  lang: Lang;
  data: PassportImageData;
  // Where a phone should go to save the picture (the card link with ?save=1). Omit on the phone itself.
  saveUrl?: string;
  onPhone?: boolean;
}) {
  const c = COPY[lang];
  const [scanQr, setScanQr] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "saved" | "shared" | "failed">("idle");

  useEffect(() => {
    if (!saveUrl) return;
    let live = true;
    QRCode.toDataURL(saveUrl, { width: 220, margin: 1, color: { dark: "#101b2b", light: "#ffffff" } })
      .then((url) => { if (live) setScanQr(url); })
      .catch(() => {});
    return () => { live = false; };
  }, [saveUrl]);

  // On the phone, show the picture right away so it can be long-pressed.
  useEffect(() => {
    if (!onPhone) return;
    let url: string | null = null;
    renderPassportPng(data).then((blob) => { url = URL.createObjectURL(blob); setPreview(url); }, () => setState("failed"));
    return () => { if (url) URL.revokeObjectURL(url); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPhone, data.code, data.cardUrl]);

  async function save() {
    setState("busy");
    try {
      const outcome = await savePassportPng(await renderPassportPng(data), data.code);
      setState(outcome === "shared" ? "shared" : "saved");
    } catch {
      setState("failed");
    }
  }

  return (
    <section className="lab-save" aria-labelledby="lab-save-title" data-testid="passport-save">
      <div className="lab-save-text">
        <h3 id="lab-save-title"><ImageDown size={18} aria-hidden="true" /> {c.title}</h3>
        <p>{c.body}</p>
        {onPhone && preview && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="lab-save-preview" src={preview} alt={`HRI Passport ${data.code}`} data-testid="passport-png" />
            <p className="lab-save-note">{c.phone}</p>
          </>
        )}
        <button type="button" className="lab-cta" onClick={save} disabled={state === "busy"} data-testid="passport-download">
          <Download size={18} aria-hidden="true" /> {state === "busy" ? c.saving : onPhone ? c.save : c.download}
        </button>
        <p className="lab-save-note" role="status">{state === "saved" ? c.saved : state === "shared" ? c.shared : state === "failed" ? c.failed : ""}</p>
      </div>
      {saveUrl && scanQr && (
        <figure className="lab-save-qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={scanQr} alt={c.scan} width={180} height={180} data-testid="passport-save-qr" />
          <figcaption><QrCode size={14} aria-hidden="true" /> {c.scan}</figcaption>
        </figure>
      )}
    </section>
  );
}
