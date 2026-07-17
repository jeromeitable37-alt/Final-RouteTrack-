import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/PwaSupport";

export const metadata: Metadata = {
  title: "RouteTrack — PRF, SRF, CRF and PO Monitoring",
  description:
    "Mobile-friendly document routing and chain-of-custody monitoring for student assistants.",
  applicationName: "RouteTrack",
};

export const viewport: Viewport = {
  themeColor: "#174f7c",
  width: "device-width",
  initialScale: 1,
};

const themeInitializationScript = `
  (() => {
    try {
      const saved = localStorage.getItem("routetrack-theme");
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const theme = saved === "dark" || saved === "light"
        ? saved
        : systemDark
          ? "dark"
          : "light";

      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch (_) {
      document.documentElement.dataset.theme = "light";
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeInitializationScript }}
        />
      </head>
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
