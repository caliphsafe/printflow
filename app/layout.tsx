import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrintFlow Customizer",
  description: "White-label custom apparel designer and checkout handoff."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
