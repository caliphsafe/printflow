import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrintFlow — Custom Apparel Commerce",
  description: "Supplier-connected custom apparel storefronts, pricing, checkout, and production operations."
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
