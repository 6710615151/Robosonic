"use client";

// The Living Lab's signature: the green HumanoidTH robot greeting the visitor with a wai.
// It is the real 3D model (public/teal_v.2.glb in the brand livery), not a picture, and it is
// labelled as a simulation. Without WebGL the same character appears as the WaiBot illustration.
import { useCallback, useEffect, useRef, useState } from "react";
import { Hand } from "lucide-react";
import RobotStage from "@/app/components/robot/RobotStage";
import WaiBot from "@/app/components/brand/WaiBot";
import type { RobotBehavior } from "@/lib/hri/behavior-engine";
import { webglAvailable, type SimState } from "./lab-env";

export default function HeroRobot({ label, caption, greet, fallbackCaption }: { label: string; caption: string; greet: string; fallbackCaption: string }) {
  const [sim, setSim] = useState<SimState>("pending");
  const robotRef = useRef<RobotBehavior | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => { setSim(webglAvailable() ? "ok" : "off"); }, []);
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  const wai = useCallback(() => {
    const robot = robotRef.current;
    if (!robot) return;
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
    const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    robot.bothArms("wai");
    robot.expression("calm");
    later(450, () => robot.bow(0.32, 1.6));
    later(2600, () => { robot.bothArms("relaxed"); robot.expression("happy"); });
  }, []);

  const onReady = useCallback((robot: RobotBehavior) => {
    robotRef.current = robot;
    // Hands on hips (the model's rest pose) reads as impolite in Thai settings: stand relaxed.
    robot.bothArms("relaxed");
    robot.setGlow(0.6, "lime");
    robot.snap();
    // Greet on arrival, unless the visitor asked for less motion; the button always works.
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) timers.current.push(window.setTimeout(wai, 900));
  }, [wai]);

  return (
    <figure className="llx-robot">
      <div className="llx-robot-stage">
        {sim === "off" ? (
          <WaiBot pose="wai" size={300} className="llx-robot-fallback" title={label} />
        ) : sim === "ok" ? (
          <RobotStage framing="portrait" pointerGaze draggable livery="atlas" onReady={onReady} ariaLabel={label} className="llx-robot-canvas" />
        ) : null}
      </div>
      <figcaption>
        <span>{sim === "off" ? fallbackCaption : caption}</span>
        {sim === "ok" && (
          <button type="button" className="llx-greet" onClick={wai}>
            <Hand size={15} aria-hidden="true" /> {greet}
          </button>
        )}
      </figcaption>
    </figure>
  );
}
