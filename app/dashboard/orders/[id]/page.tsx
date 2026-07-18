import { notFound } from "next/navigation";
import { getAdminContext } from "@/lib/admin-data";
import OrderBlanksButton from "@/components/OrderBlanksButton";
import BlankOrderDraftButton from "@/components/BlankOrderDraftButton";

export const dynamic = "force-dynamic";

function title(value?: string) {
  if (!value) return "—";
  return value.split("-").map((part) => part.slice(0, 1).toUpperCase() + part.slice(1)).join(" ");
}

function safeDownloadName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/(^-|-$)/g, "") || "printflow-file";
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

  const sides = o.design_sides && Object.keys(o.design_sides).length
    ? o.design_sides
    : { front: { originalPath: o.original_artwork_path, previewPath: o.preview_path, filename: o.original_filename } };

  const sideFiles = await Promise.all(
    Object.entries(sides).map(async ([side, value]: [string, any]) => {
      const originalName = safeDownloadName(`${o.display_id}-${side}-${value.filename || "artwork"}`);
      const previewName = safeDownloadName(`${o.display_id}-${side}-mockup.png`);
      const [artView, artDownload, previewView, previewDownload] = await Promise.all([
        supabase.storage.from("artwork").createSignedUrl(value.originalPath, 3600),
        supabase.storage.from("artwork").createSignedUrl(value.originalPath, 3600, { download: originalName }),
        supabase.storage.from("previews").createSignedUrl(value.previewPath, 3600),
        supabase.storage.from("previews").createSignedUrl(value.previewPath, 3600, { download: previewName })
      ]);
      return {
        side,
        value,
        artView: artView.data?.signedUrl,
        artDownload: artDownload.data?.signedUrl,
        previewView: previewView.data?.signedUrl,
        previewDownload: previewDownload.data?.signedUrl
      };
    })
  );

  const supplierItems = Array.isArray(o.supplier_items) ? o.supplier_items : [];
  const testMode = connection?.settings?.testMode !== false;
  const config = o.design_configuration || {};
  const printSizes = config.printSizes || {};
  const addOns = Array.isArray(config.addOns) ? config.addOns : [];
  const garmentSubtotal = Number(config.garmentSubtotal || 0);
  const supplierGarmentCost = Number(config.supplierGarmentCost || 0);
  const garmentMarkupAmount = Number(config.garmentMarkupAmount || 0);
  const printSubtotal = Number(config.printSubtotal || 0);
  const printLines = Array.isArray(config.printLines) ? config.printLines : [];
  const merchandiseSubtotal = Number(config.merchandiseSubtotal ?? Number(config.unitPrice || 0) * Number(o.package_quantity || 0));
  const setupFee = Number(config.setupFee || 0);
  const designFee = Number(config.designOptimizationFee || 0);
  const addOnTotal = Number(config.addOnTotal || addOns.reduce((sum: number, item: any) => sum + Number(item.total || 0), 0));
  const orderTotal = Number(config.totalPrice ?? o.package_price ?? 0);

  return <>
    <header className="admin-header order-detail-header">
      <div><p className="eyebrow">{o.display_id}</p><h1>{o.customer_name}</h1><p>{o.customer_email} {o.customer_phone ? `· ${o.customer_phone}` : ""}</p></div>
      <div className="order-header-meta"><span className="status-pill">{o.status.replaceAll("_", " ")}</span><strong>${orderTotal.toFixed(2)}</strong><small>{Number(o.package_quantity || 0)} garments</small></div>
    </header>

    <section className="order-detail-summary">
      <div><span>Product</span><strong>{o.product_name}</strong></div>
      <div><span>Color</span><strong>{o.shirt_color_name}</strong></div>
      <div><span>Decoration</span><strong>{config.decorationMethod || "—"}</strong></div>
      <div><span>Design</span><strong>{title(config.designMode || o.print_location)}</strong></div>
      <div><span>Payment</span><strong>{title(o.payment_status || "not started")}{o.payment_provider ? ` · ${title(o.payment_provider)}` : ""}</strong></div>
    </section>

    <div className="detail-grid order-detail-grid">
      <section className="admin-card order-production-card">
        <div className="card-heading"><div><p className="section-kicker">PRODUCTION</p><h2>Order specifications</h2></div><span className="status-pill connected">Files ready</span></div>
        <dl className="details-list polished-details-list">
          {printSizes.front && <div><dt>Front print</dt><dd>{title(printSizes.front)}</dd></div>}
          {printSizes.back && <div><dt>Back print</dt><dd>{title(printSizes.back)}</dd></div>}
          <div><dt>Sizes</dt><dd>{(o.size_breakdown || []).filter((x: any) => x.quantity > 0).map((x: any) => `${x.size}: ${x.quantity}`).join(", ")}</dd></div>
          <div><dt>Design optimization</dt><dd>{config.designOptimizationRequested ? "Requested" : "Not requested"}</dd></div>
          <div><dt>Customer notes</dt><dd>{o.customer_notes || "—"}</dd></div>
        </dl>
      </section>

      <section className="admin-card order-pricing-card">
        <div className="card-heading"><div><p className="section-kicker">CUSTOMER PRICING</p><h2>Verified total</h2></div><strong className="order-total-figure">${orderTotal.toFixed(2)}</strong></div>
        <div className="admin-price-breakdown">
          <div><span>Supplier garment cost</span><b>${supplierGarmentCost.toFixed(2)}</b></div>
          <div><span>Garment markup · {Number(config.garmentMarkupPercent || 0).toFixed(1)}%</span><b>${garmentMarkupAmount.toFixed(2)}</b></div>
          <div className="subtotal"><span>Customer garment subtotal</span><b>${garmentSubtotal.toFixed(2)}</b></div>
          {printLines.map((line: any) => <div key={`${line.side}-${line.printSize}`}><span>{title(line.side)} · {title(line.printSize)}{line.inkColors ? ` · ${line.inkColors} color${line.inkColors === 1 ? "" : "s"}` : ""}</span><b>${Number(line.unitPrice || 0).toFixed(2)} / shirt</b></div>)}
          {config.discountTierLabel && <div><span>Production threshold</span><b>{config.discountTierLabel}</b></div>}
          <div className="subtotal"><span>Print subtotal</span><b>${printSubtotal.toFixed(2)}</b></div>
          <div className="subtotal"><span>Merchandise · {o.package_quantity} items</span><b>${merchandiseSubtotal.toFixed(2)}</b></div>
          {setupFee > 0 && <div><span>{config.setupFeeLabel || "Order setup"}</span><b>${setupFee.toFixed(2)}</b></div>}
          {designFee > 0 && <div><span>{config.designOptimizationLabel || "Design optimization"}</span><b>${designFee.toFixed(2)}</b></div>}
          {addOns.map((item: any) => <div key={item.id}><span>{item.name}</span><b>${Number(item.total || 0).toFixed(2)}</b></div>)}
          {addOnTotal > 0 && <div className="subtotal"><span>Add-ons subtotal</span><b>${addOnTotal.toFixed(2)}</b></div>}
          <div className="total"><span>Customer total</span><b>${orderTotal.toFixed(2)}</b></div>
          {o.paid_amount != null && <div className="paid-line"><span>Amount received</span><b>${Number(o.paid_amount).toFixed(2)}</b></div>}
          {o.payment_reference && <div className="payment-reference"><span>Payment reference</span><code>{o.payment_reference}</code></div>}
        </div>
      </section>
    </div>

    <section className="admin-card order-files-section">
      <div className="card-heading"><div><p className="section-kicker">PRODUCTION FILES</p><h2>Artwork & customer mockups</h2><p>View files in the browser or download the original production assets.</p></div></div>
      <div className="order-side-files upgraded">
        {sideFiles.map((file) => <article key={file.side} className="order-file-card">
          <header><div><span className="file-side-badge">{file.side === "front" ? "F" : "B"}</span><div><h3>{title(file.side)}</h3><small>{title(file.value.printSize || printSizes[file.side])} · {file.value.filename || "Artwork file"}</small></div></div><span className="status-pill connected">Ready</span></header>
          <div className="order-file-preview">{file.previewView ? <img src={file.previewView} alt={`${file.side} customer mockup`} /> : <div>Preview unavailable</div>}</div>
          <div className="file-download-groups">
            <div><span>Uploaded design</span><div>{file.artView && <a className="secondary-button" href={file.artView} target="_blank" rel="noreferrer">View</a>}{file.artDownload && <a className="primary-button" href={file.artDownload}>Download design</a>}</div></div>
            <div><span>Customer mockup</span><div>{file.previewView && <a className="secondary-button" href={file.previewView} target="_blank" rel="noreferrer">View</a>}{file.previewDownload && <a className="primary-button" href={file.previewDownload}>Download mockup</a>}</div></div>
          </div>
        </article>)}
      </div>
    </section>

    {supplierItems.length > 0 && <section className="admin-card supplier-order-card">
      <div className="card-heading"><div><p className="eyebrow">SUPPLIER FULFILLMENT</p><h2>Blank purchase</h2></div><span className="status-pill">{connection?.status === "connected" ? (testMode ? "S&S test mode" : "S&S live ordering") : "Draft workflow"}</span></div>
      <div className="supplier-line-list">{supplierItems.map((x: any) => <div className="supplier-line" key={`${x.sku}-${x.sizeName}`}><div><strong>{x.brandName} {x.styleName}</strong><span>{x.colorName} · {x.sizeName}</span></div><div><strong>{x.quantity} pcs</strong><span>{x.sku}</span></div></div>)}</div>
      <BlankOrderDraftButton designId={o.id} enabled={o.status === "paid" && supplierItems.length > 0} existing={draft} />
      {supplierOrder && <div className="supplier-order-confirmation"><span>S&S order number</span><strong>{(supplierOrder.external_order_numbers || []).join(", ") || "Submitted"}</strong></div>}
      <OrderBlanksButton designId={o.id} enabled={o.status === "paid" && connection?.status === "connected" && supplierItems.length > 0} testMode={testMode} alreadyOrdered={Boolean(supplierOrder)} />
    </section>}
  </>;
}
