"use client";

import { useEffect, useState } from "react";
import WaiBot from "./brand/WaiBot";
import AtlasLogo from "./brand/AtlasLogo";

export default function FirstTimeLoader() {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    setMounted(true);
    const hasLoaded = sessionStorage.getItem("th_atlas_loaded_before");
    if (!hasLoaded) {
      setShow(true);
      // Run progress bar animation
      const duration = 1800; // 1.8 seconds (fast, premium, non-blocking)
      const intervalTime = 30;
      const steps = duration / intervalTime;
      const increment = 100 / steps;

      let currentProgress = 0;
      const timer = setInterval(() => {
        currentProgress += increment;
        if (currentProgress >= 100) {
          currentProgress = 100;
          clearInterval(timer);
          // Wait briefly at 100% then start fadeOut
          setTimeout(() => {
            setFadeOut(true);
            // Fully remove loader after animation finishes
            setTimeout(() => {
              setShow(false);
              sessionStorage.setItem("th_atlas_loaded_before", "true");
            }, 500);
          }, 200);
        }
        setProgress(Math.round(currentProgress));
      }, intervalTime);

      return () => clearInterval(timer);
    }
  }, []);

  if (!mounted || !show) return null;

  const getStatusText = (prog: number) => {
    if (prog < 25) return "CONNECTING";
    if (prog < 50) return "INDEXING ECOSYSTEM";
    if (prog < 75) return "CALIBRATING SOLVERS";
    if (prog < 95) return "SYNCHRONIZING";
    return "READY";
  };

  return (
    <div className={`splash-screen ${fadeOut ? "fade-out" : ""}`} role="status" aria-live="polite">
      <div className="splash-content">
        <WaiBot pose="loading" size={150} className="splash-bot" decorative />
        <AtlasLogo width={260} className="splash-logo" />
        <div className="progress-section">
          <div className="progress-track">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <div className="status-row">
            <span>{getStatusText(progress)}</span>
            <span>{progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
