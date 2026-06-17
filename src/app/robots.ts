import type { MetadataRoute } from "next";

/**
 * Robots policy. The customer app is crawlable; the internal Ops Console and
 * its APIs are explicitly disallowed (belt-and-braces alongside the per-route
 * `X-Robots-Tag: noindex` header set by the proxy and the Ops layout metadata).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/ops", "/ops/", "/api/ops", "/api/auth"],
      },
    ],
    sitemap: "https://uni-kart.com/sitemap.xml",
    host: "https://uni-kart.com",
  };
}
