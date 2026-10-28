import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OmniPoint | Otya OS",
  description: "OmniPoint by Otya Hold Ltd T/A OmniPoint — retail and financial-agency operations for the Otya family.",
  applicationName: "OmniPoint",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#102A43",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
