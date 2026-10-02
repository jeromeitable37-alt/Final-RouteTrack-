import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./ui-enhancements.css";
import "./branding-overrides.css";
import "./purchasing-reference-ui.css";
import { PwaRegister } from "@/components/PwaSupport";

export const metadata: Metadata = {
  title: "Purchasing Monitoring — SISC",
  description: "Professional purchasing document routing and monitoring for Southville International School and Colleges.",
  applicationName: "Purchasing Monitoring",
};

export const viewport: Viewport = {
  themeColor: "#07543f",
  width: "device-width",
  initialScale: 1,
};

const themeInitializationScript = `
  (() => {
    try {
      const saved = localStorage.getItem("routetrack-theme");
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const theme = saved === "dark" || saved === "light" ? saved : systemDark ? "dark" : "light";
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch (_) {
      document.documentElement.dataset.theme = "light";
    }
  })();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} /></head>
      <body><PwaRegister />{children}</body>
    </html>
  );
}
