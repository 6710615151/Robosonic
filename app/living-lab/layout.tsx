import type { ReactNode } from "react";
import "./lab-theme.css";

// Every /living-lab route shares the Living Lab design system (lab-theme.css), scoped to this wrapper.
// There is no lab navigation: the Living Lab is one page, the call room (page.tsx); the passport card
// (passport/[token]) stays reachable from its QR for saving the picture, editing and deleting.
export default function LivingLabLayout({ children }: { children: ReactNode }) {
  return <div className="lab">{children}</div>;
}
