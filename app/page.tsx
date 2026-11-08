import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// The HRI Living Lab is the site's front door: a Gemini conversation with Atlas that ends in a
// Care Passport. The research atlas that used to live here is now at /overview.
export default function HomePage() {
  redirect("/living-lab");
}
