import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RouteTrack Document Routing Monitor",
    short_name: "RouteTrack",
    description: "Quick PRF, SRF, CRF, and PO routing monitoring.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f7fa",
    theme_color: "#174f7c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
