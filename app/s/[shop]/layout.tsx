import type { ReactNode } from "react";
import StorefrontEmbedBridge from "./StorefrontEmbedBridge";
import "./storefront.css";
import "./theme.css";
import "./runtime.css";

export default function StorefrontLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <>
      <StorefrontEmbedBridge />
      {children}
    </>
  );
}
