"use client";

import { useEffect } from "react";

type StorefrontView = "products" | "customize";

function storefrontState() {
  const shell = document.querySelector(".modern-customer-shell");
  const step = shell?.getAttribute("data-flow-step") || "products";
  const view: StorefrontView = step === "products" ? "products" : "customize";
  const page = window.location.pathname + "::" + step;

  return { page, view };
}

function documentHeight() {
  const shell = document.querySelector(".modern-customer-shell");

  if (shell) {
    const rect = shell.getBoundingClientRect();
    return Math.ceil(
      Math.max(
        shell.scrollHeight || 0,
        rect.height || 0,
        rect.bottom + window.scrollY || 0
      )
    );
  }

  const body = document.body;
  const root = document.documentElement;
  return Math.ceil(
    Math.max(
      body?.scrollHeight || 0,
      body?.offsetHeight || 0,
      root.scrollHeight || 0,
      root.offsetHeight || 0
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

    let lastPage = "";
    let lastView: StorefrontView | "" = "";
    let lastHeight = 0;
    let frame = 0;

    const publish = () => {
      if (frame) cancelAnimationFrame(frame);

      frame = requestAnimationFrame(() => {
        frame = 0;

        const { page, view } = storefrontState();
        const height = documentHeight();
        const pageChanged = page !== lastPage;
        const viewChanged = view !== lastView;

        if (pageChanged) {
          lastPage = page;
          window.parent.postMessage(
            { type: "printflow:page", page, view, height },
            "*"
          );
        }

        if (viewChanged) {
          lastView = view;
          window.parent.postMessage(
            { type: "printflow:view", view, height },
            "*"
          );
        }

        if (pageChanged || height !== lastHeight) {
          lastHeight = height;
          window.parent.postMessage(
            { type: "printflow:resize", height, page },
            "*"
          );
        }
      });
    };

    const shell =
      document.querySelector(".modern-customer-shell") ||
      document.querySelector(".storefront-offline-shell");

    const mutationObserver = new MutationObserver(publish);
    mutationObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-flow-step"],
      childList: true,
      subtree: true
    });

    const resizeObserver = new ResizeObserver(publish);
    resizeObserver.observe(document.body);
    if (shell) resizeObserver.observe(shell);

    window.addEventListener("resize", publish);
    publish();

    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", publish);
      if (frame) cancelAnimationFrame(frame);

      root.classList.remove("printflow-embedded");
    };
  }, []);

  return null;
}
