import type { ReactNode } from "react";
import "./lab-theme.css";

// Every /living-lab route shares the Living Lab design system (lab-theme.css), scoped to this wrapper.
export default function LivingLabLayout({ children }: { children: ReactNode }) {
  return <div className="lab">{children}</div>;
}
