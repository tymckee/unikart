import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://uni-kart.com"),
  title: {
    default: "UniKart — A calm way to buy",
    template: "%s · UniKart",
  },
  description:
    "Save products from any store, track price and stock, set target-price alerts, and check out with less chaos. UniKart is your calm buying operating system.",
  applicationName: "UniKart",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "UniKart",
  },
  formatDetection: { telephone: false },
  keywords: [
    "wishlist",
    "price tracker",
    "universal cart",
    "shopping",
    "stock alerts",
  ],
  openGraph: {
    title: "UniKart — A calm way to buy",
    description:
      "Save what you want, understand when to buy, and check out with less chaos.",
    siteName: "UniKart",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#fbfbfd",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
