import { redirect } from "next/navigation";

// Retired 2026-11-08: the Living Lab is now one page, the call room at /living-lab. The previous page
// for this route is in git history (feat/living-lab-ux before this change) if it is ever wanted back.
export default function RetiredLivingLabRoute() {
  redirect("/living-lab");
}
