import { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://humanoid.or.th";

  const routes = [
    "/living-lab",
    "/overview",
    "/robots",
    "/perspectives",
    "/contributions",
    "/map",
    "/network",
    "/analytics",
    "/inventory",
    "/submit-data"
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: route === "/living-lab" ? 1.0 : 0.8
  }));
}
