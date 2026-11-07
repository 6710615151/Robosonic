import type { ReactNode } from "react";
import { cookies } from "next/headers";
import LabShell from "./components/LabShell";
import "./lab-theme.css";

// Every /living-lab route shares the Living Lab design system (lab-theme.css), scoped to this wrapper,
// and the same shell: brand, honest lab status and the section tabs.
export default async function LivingLabLayout({ children }: { children: ReactNode }) {
  const lang = (await cookies()).get("lang")?.value === "th" ? "th" : "en";
  // Only whether a key exists: the key itself never leaves the server.
  const aiConfigured = Boolean(process.env.GEMINI_API_KEY);
  return (
    <div className="lab">
      <LabShell lang={lang} aiConfigured={aiConfigured} />
      {children}
    </div>
  );
}
