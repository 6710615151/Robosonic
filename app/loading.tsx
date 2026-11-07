import WaiBot from "./components/brand/WaiBot";

export default function Loading() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <WaiBot pose="loading" size={96} decorative />
      <span>Synchronising atlas…</span>
    </div>
  );
}
