import type { ReactNode } from "react";
import StorefrontEmbedBridge from "./StorefrontEmbedBridge";
import "./storefront.css";
import "./theme.css";
import "./runtime.css";
import "./storefront-flow.css";

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
