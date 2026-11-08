// The Care Passport as a picture the owner keeps on their phone and later holds up to a robot.
// Drawn in the browser (so Thai text uses the page's own fonts), never on the server. The QR on the
// picture is the passport card link: a robot that scans it reads the token from that link and asks the
// public API for the preferences, exactly as if the link had been pasted (robot/RobotConsoleClient.tsx).
import QRCode from "qrcode";

export type PassportImageData = {
  heading: string; // "HRI PASSPORT"
  motto: string;
  codeLabel: string;
  code: string;
  cardUrl: string; // what the QR encodes
  prefs: { label: string; value: string }[];
  scanNote: string; // "Show this to a robot"
  mrz: string;
};

const W = 1200;
const H = 760;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Shrink text until it fits the width (long Thai values).
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, weight: string, size: number, family: string) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && s > 14) {
    s -= 1;
    ctx.font = `${weight} ${s}px ${family}`;
  }
}

export async function renderPassportPng(d: PassportImageData): Promise<Blob> {
  if (typeof document !== "undefined" && document.fonts?.ready) await document.fonts.ready;
  const family = getComputedStyle(document.body).fontFamily || "sans-serif";
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");

  // Card: obsidian navy with a faint grid, like the lab.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#101b2b");
  bg.addColorStop(1, "#1b2a40");
  roundRect(ctx, 0, 0, W, H, 40);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = "rgba(237, 233, 223, 0.05)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();

  // Header
  ctx.fillStyle = "#b5c99a";
  ctx.font = `700 30px ${family}`;
  ctx.fillText(d.heading, 64, 92);
  ctx.fillStyle = "#c4cbd4";
  fit(ctx, d.motto, W - 128, "500", 24, family);
  ctx.fillText(d.motto, 64, 132);

  // QR on a white tile
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, d.cardUrl, { width: 300, margin: 1, errorCorrectionLevel: "M", color: { dark: "#101b2bff", light: "#ffffffff" } });
  roundRect(ctx, 64, 172, 340, 340, 24);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.drawImage(qr, 84, 192, 300, 300);

  // Code
  ctx.fillStyle = "#aab3bf";
  ctx.font = `600 22px ${family}`;
  ctx.fillText(d.codeLabel, 450, 220);
  ctx.fillStyle = "#ede9df";
  ctx.font = `700 96px ${family}`;
  ctx.fillText(d.code, 446, 316);
  ctx.fillStyle = "#e49a65";
  fit(ctx, d.scanNote, W - 450 - 64, "600", 26, family);
  ctx.fillText(d.scanNote, 450, 372);

  // Preferences: up to five tiles in one row
  const prefs = d.prefs.slice(0, 5);
  const gap = 14;
  const tileW = (W - 128 - gap * (prefs.length - 1)) / Math.max(1, prefs.length);
  prefs.forEach((p, i) => {
    const x = 64 + i * (tileW + gap);
    roundRect(ctx, x, 548, tileW, 110, 16);
    ctx.fillStyle = "rgba(237, 233, 223, 0.07)";
    ctx.fill();
    ctx.strokeStyle = "rgba(237, 233, 223, 0.16)";
    ctx.stroke();
    ctx.fillStyle = "#aab3bf";
    fit(ctx, p.label, tileW - 32, "500", 20, family);
    ctx.fillText(p.label, x + 16, 584);
    ctx.fillStyle = "#ffffff";
    fit(ctx, p.value, tileW - 32, "700", 28, family);
    ctx.fillText(p.value, x + 16, 630);
  });

  // Machine-readable line
  ctx.fillStyle = "rgba(237, 233, 223, 0.45)";
  ctx.font = `500 22px ui-monospace, Menlo, monospace`;
  ctx.fillText(d.mrz, 64, 712);

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("png failed"))), "image/png"));
}

// Keep it on the device: the share sheet on phones (Save Image / Photos), a normal download elsewhere.
export async function savePassportPng(blob: Blob, code: string): Promise<"shared" | "downloaded"> {
  const name = `hri-passport-${code}.png`;
  const file = new File([blob], name, { type: "image/png" });
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (coarse && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch {
      // Cancelled or blocked: fall through to a download.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}
