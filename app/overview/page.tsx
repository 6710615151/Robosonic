import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// The overview lives at "/" now. Keep the old /overview link working for bookmarks and shared links.
export default function OverviewRedirectPage() {
  redirect("/");
}
