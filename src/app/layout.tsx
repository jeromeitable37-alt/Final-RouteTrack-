import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RouteTrack — PRF, SRF, CRF and PO Monitoring",
  description: "Mobile-friendly document routing and chain-of-custody monitoring for student assistants.",
  applicationName: "RouteTrack",
};

export const viewport: Viewport = {
  themeColor: "#174f7c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
