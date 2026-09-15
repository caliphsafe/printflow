"use client";

import { useEffect } from "react";

type StorefrontView = "products" | "customize";

function storefrontView(): StorefrontView {
  return document.querySelector(".modern-designer-layout")
    ? "customize"
    : "products";
}

function documentHeight() {
  return Math.ceil(
    Math.max(
      document.documentElement.scrollHeight || 0,
      document.body?.scrollHeight || 0
    )
  );
}

export default function StorefrontEmbedBridge() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const embedded =
      params.get("embed") === "1" && window.parent !== window;

    if (!embedded) return;

    const root = document.documentElement;
    root.classList.add("printflow-embedded");

    let lastView: StorefrontView | "" = "";
    let frame = 0;

    const publish = () => {
      if (frame) cancelAnimationFrame(frame);

      frame = requestAnimationFrame(() => {
        const view = storefrontView();
        const customize = view === "customize";

        root.classList.toggle(
          "printflow-embedded-customize",
          customize
        );

        if (view !== lastView) {
          lastView = view;
          window.parent.postMessage(
            {
              type: "printflow:view",
              view,
              height: documentHeight()
            },
            "*"
          );
        }

        /*
          Product selection is intentionally content-height driven so an
          embedded catalog behaves like a normal page.

          Desktop customization is intentionally NOT content-height driven.
          Its parent gives the iframe a viewport and the configuration column
          scrolls inside that viewport. This is what lets the garment stay
          visible while colors, decoration, quantities, and order details move.
        */
        if (!customize) {
          window.parent.postMessage(
            {
              type: "printflow:resize",
              height: documentHeight()
            },
            "*"
          );
        }
      });
    };

    publish();

    const target =
      document.querySelector(".modern-customer-shell") ||
      document.body;

    const observer = new MutationObserver(publish);
    observer.observe(target, {
      childList: true,
      subtree: true
    });

    window.addEventListener("resize", publish);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", publish);
      if (frame) cancelAnimationFrame(frame);

      root.classList.remove(
        "printflow-embedded",
        "printflow-embedded-customize"
      );
    };
  }, []);

  return null;
}
