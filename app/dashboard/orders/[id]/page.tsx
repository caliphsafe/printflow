import { notFound } from "next/navigation";
import { getAdminContext } from "@/lib/admin-data";
import OrderBlanksButton from "@/components/OrderBlanksButton";
import BlankOrderDraftButton from "@/components/BlankOrderDraftButton";

export const dynamic = "force-dynamic";

function title(value?: string) {
  if (!value) return "—";
  return value
    .split("-")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, shop } = await getAdminContext();
  if (!shop) notFound();

  const [{ data: o }, { data: supplierOrder }, { data: connection }, { data: draft }] = await Promise.all([
    supabase.from("designs").select("*").eq("id", id).eq("shop_id", shop.id).single(),
    supabase.from("supplier_orders").select("*").eq("design_id", id).eq("provider", "ss-activewear").maybeSingle(),
    supabase.from("supplier_connections").select("settings,status").eq("shop_id", shop.id).eq("provider", "ss-activewear").maybeSingle(),
    supabase.from("supplier_order_drafts").select("status,estimated_total").eq("design_id", id).maybeSingle()
  ]);
  if (!o) notFound();

  const sides =
    o.design_sides && Object.keys(o.design_sides).length
      ? o.design_sides
      : { front: { originalPath: o.original_artwork_path, previewPath: o.preview_path, filename: o.original_filename } };
  const sideFiles = await Promise.all(
    Object.entries(sides).map(async ([side, value]: [string, any]) => {
      const [art, preview] = await Promise.all([
        supabase.storage.from("artwork").createSignedUrl(value.originalPath, 3600),
        supabase.storage.from("previews").createSignedUrl(value.previewPath, 3600)
      ]);
      return { side, value, art: art.data?.signedUrl, preview: preview.data?.signedUrl };
    })
  );
  const supplierItems = Array.isArray(o.supplier_items) ? o.supplier_items : [];
  const testMode = connection?.settings?.testMode !== false;
  const config = o.design_configuration || {};
  const printSizes = config.printSizes || {};

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">{o.display_id}</p>
          <h1>{o.customer_name}</h1>
          <p>
            {o.customer_email} {o.customer_phone ? `· ${o.customer_phone}` : ""}
          </p>
        </div>
        <span className="status-pill">{o.status.replaceAll("_", " ")}</span>
      </header>

      <div className="detail-grid">
        <section className="admin-card">
          <h2>Production details</h2>
          <dl className="details-list">
            <div><dt>Product</dt><dd>{o.product_name}</dd></div>
            <div><dt>Order pricing</dt><dd>{o.package_label} · ${Number(o.package_price).toFixed(2)}</dd></div>
            <div><dt>Color</dt><dd>{o.shirt_color_name}</dd></div>
            <div><dt>Design sides</dt><dd>{title(config.designMode || o.print_location)}</dd></div>
            {printSizes.front && <div><dt>Front print</dt><dd>{title(printSizes.front)}</dd></div>}
            {printSizes.back && <div><dt>Back print</dt><dd>{title(printSizes.back)}</dd></div>}
            <div><dt>Decoration</dt><dd>{config.decorationMethod || "—"}</dd></div>
            <div><dt>Blank / shirt</dt><dd>${Number(config.garmentUnitPrice || 0).toFixed(2)} each</dd></div>
            {printSizes.front && <div><dt>Front print cost</dt><dd>${Number(config.frontPrintUnitPrice || 0).toFixed(2)} each</dd></div>}
            {printSizes.back && <div><dt>Back print cost</dt><dd>${Number(config.backPrintUnitPrice || 0).toFixed(2)} each</dd></div>}
            <div><dt>Final unit price</dt><dd>${Number(config.unitPrice || 0).toFixed(2)} each</dd></div>
            <div>
              <dt>Sizes</dt>
              <dd>{(o.size_breakdown || []).filter((x: any) => x.quantity > 0).map((x: any) => `${x.size}: ${x.quantity}`).join(", ")}</dd>
            </div>
            <div><dt>Notes</dt><dd>{o.customer_notes || "—"}</dd></div>
          </dl>
        </section>

        <section className="admin-card">
          <h2>Artwork & mockups</h2>
          <div className="order-side-files">
            {sideFiles.map((file) => (
              <article key={file.side}>
                <div className="card-heading">
                  <div>
                    <h3>{file.side[0].toUpperCase() + file.side.slice(1)}</h3>
                    <small>{title(file.value.printSize || printSizes[file.side])}</small>
                  </div>
                  <span className="status-pill connected">Ready</span>
                </div>
                {file.preview && <img className="order-preview" src={file.preview} alt={`${file.side} preview`} />}
                <div className="file-actions">
                  {file.art && <a className="secondary-button" href={file.art}>Original artwork</a>}
                  {file.preview && <a className="secondary-button" href={file.preview}>Production mockup</a>}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {supplierItems.length > 0 && (
        <section className="admin-card supplier-order-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">SUPPLIER FULFILLMENT</p>
              <h2>Blank purchase</h2>
            </div>
            <span className="status-pill">
              {connection?.status === "connected" ? (testMode ? "S&S test mode" : "S&S live ordering") : "Draft workflow"}
            </span>
          </div>
          <div className="supplier-line-list">
            {supplierItems.map((x: any) => (
              <div className="supplier-line" key={x.sku}>
                <div>
                  <strong>{x.brandName} {x.styleName}</strong>
                  <span>{x.colorName} · {x.sizeName}</span>
                </div>
                <div>
                  <strong>{x.quantity} pcs</strong>
                  <span>{x.sku}</span>
                </div>
              </div>
            ))}
          </div>
          <BlankOrderDraftButton designId={o.id} enabled={o.status === "paid" && supplierItems.length > 0} existing={draft} />
          {supplierOrder && (
            <div className="supplier-order-confirmation">
              <span>S&S order number</span>
              <strong>{(supplierOrder.external_order_numbers || []).join(", ") || "Submitted"}</strong>
            </div>
          )}
          <OrderBlanksButton
            designId={o.id}
            enabled={o.status === "paid" && connection?.status === "connected" && supplierItems.length > 0}
            testMode={testMode}
            alreadyOrdered={Boolean(supplierOrder)}
          />
        </section>
      )}
    </>
  );
}
