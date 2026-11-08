import path from "node:path";
import type { NextConfig } from "next";

// The Living Lab is one page (the call room at /living-lab) since 2026-11-08. Its former sub-pages
// redirect there; the passport card (/living-lab/passport/[token]) and the API are unchanged.
const RETIRED_LIVING_LAB = ["about", "create", "robot", "meet", "meet/:code", "research"];

const nextConfig: NextConfig = {
  typedRoutes: false,
  outputFileTracingRoot: path.join(process.cwd()),
  async redirects() {
    return RETIRED_LIVING_LAB.map((route) => ({ source: `/living-lab/${route}`, destination: "/living-lab", permanent: false }));
  }
};

export default nextConfig;
