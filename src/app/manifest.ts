import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UniKart — A calm way to buy",
    short_name: "UniKart",
    description:
      "Save products from any store, track price and stock, and check out with less chaos.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#fbfbfd",
    theme_color: "#fbfbfd",
    orientation: "portrait",
    categories: ["shopping", "productivity", "lifestyle"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
