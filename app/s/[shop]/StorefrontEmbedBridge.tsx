"use client";

import { useEffect } from "react";

type StorefrontView = "products" | "customize";

function storefrontView(): StorefrontView {
  const step = document
    .querySelector(".modern-customer-shell")
    ?.getAttribute("data-flow-step");
  return step && step !== "products" ? "customize" : "products";
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

        // Keep every wizard step in normal document flow so the host page
        // can size its frame from content without trapping a second scroll area.
        window.parent.postMessage(
          {
            type: "printflow:resize",
            height: documentHeight()
          },
          "*"
        );
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

      root.classList.remove("printflow-embedded");
    };
  }, []);

  return null;
}
