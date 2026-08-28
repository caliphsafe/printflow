"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SCHOOL_IMAGE_BY_SLUG: Record<string, string> = {
  "espirito-youth-red-short-polo":
    "https://static.wixstatic.com/media/cba43b_085034bcf27b4db78513bcd6f22230e8~mv2.png/v1/fill/w_700%2Ch_700%2Cal_c%2Cq_90/cba43b_085034bcf27b4db78513bcd6f22230e8~mv2.png",
  "espirito-adult-red-short-polo":
    "https://static.wixstatic.com/media/cba43b_085034bcf27b4db78513bcd6f22230e8~mv2.png/v1/fill/w_700%2Ch_700%2Cal_c%2Cq_90/cba43b_085034bcf27b4db78513bcd6f22230e8~mv2.png",
  "espirito-youth-red-long-polo":
    "https://static.wixstatic.com/media/cba43b_69a85c864228480e990d8916616e328e~mv2.png/v1/fill/w_700%2Ch_700%2Cal_c%2Cq_90/cba43b_69a85c864228480e990d8916616e328e~mv2.png",
  "espirito-adult-red-long-polo":
    "https://static.wixstatic.com/media/cba43b_69a85c864228480e990d8916616e328e~mv2.png/v1/fill/w_700%2Ch_700%2Cal_c%2Cq_90/cba43b_69a85c864228480e990d8916616e328e~mv2.png",
  "espirito-youth-navy-tee":
    "https://adv-emb-sp.vercel.app/assets/images/navy-tee.svg",
  "espirito-adult-navy-tee":
    "https://adv-emb-sp.vercel.app/assets/images/navy-tee.svg"
};

function schoolImage(item: any) {
  const catalog = item.catalog_products;
  const catalogColors = catalog?.configuration?.colors || [];
  const storefrontColors = item.configuration?.colors || [];

  return (
    item.image_url ||
    item.configuration?.imageUrl ||
    item.configuration?.image_url ||
    catalog?.configuration?.mockupImageUrl ||
    catalogColors.find((color: any) => color.active !== false)?.frontImageUrl ||
    storefrontColors.find((color: any) => color.active !== false)?.frontImageUrl ||
    SCHOOL_IMAGE_BY_SLUG[catalog?.slug] ||
    ""
  );
}

export default function AdvancedAdminSchoolProduct({ item }: { item: any }) {
  const router = useRouter();
  const [active, setActive] = useState(item.active !== false);
  const [price, setPrice] = useState(Number(item.price || 0));
  const [name, setName] = useState(
    item.name_override || item.catalog_products?.name || ""
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const originalName =
    item.name_override || item.catalog_products?.name || "";

  const dirty =
    active !== item.active ||
    price !== Number(item.price || 0) ||
    name !== originalName;

  const sizes =
    item.configuration?.sizes ||
    item.catalog_products?.configuration?.sizes ||
    [];

  const image = schoolImage(item);
  const style =
    item.catalog_products?.description?.split("·")?.[0]?.trim() ||
    item.catalog_products?.slug ||
    "School uniform";

  async function save() {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/advanced-admin/school/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active, price, name })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to save uniform item.");
      }

      setMessage("Uniform item saved.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save uniform item."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="ae-card ae-product-card">
      <header>
        <div>
          <p className="ae-kicker">ESPIRITO SANTO</p>
          <h3>{name}</h3>
          <small>
            {style}
            {sizes.length ? ` · ${sizes.join(" · ")}` : ""}
          </small>
        </div>

        <label className="ae-switch">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          <span>{active ? "LIVE" : "HIDDEN"}</span>
        </label>
      </header>

      <div className="ae-product-preview">
        {image ? (
          <img
            src={image}
            alt={`${name} school uniform preview`}
            loading="lazy"
          />
        ) : (
          <span>No school product image available.</span>
        )}
      </div>

      <label className="ae-field">
        <span>Customer-facing name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="ae-field">
        <span>Price per item</span>
        <div className="ae-money-wrap">
          <b>$</b>
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) =>
              setPrice(Math.max(0, Number(e.target.value || 0)))
            }
          />
        </div>
      </label>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10
        }}
      >
        <small
          className={`ae-message ${
            message.includes("saved") ? "success" : "error"
          }`}
        >
          {message}
        </small>

        <button
          className="ae-button primary"
          disabled={busy || !dirty}
          onClick={save}
        >
          {busy ? "Saving…" : "Save item"}
        </button>
      </div>
    </article>
  );
}
