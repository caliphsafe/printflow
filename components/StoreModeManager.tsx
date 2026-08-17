"use client";

import type { PlatformShopAccess, ShopAccountMode } from "@/lib/shop-mode";

function label(access: PlatformShopAccess) {
  if (access.customPrint && access.brandMerch) return "Print Shop + Brand / Merch";
  if (access.brandMerch) return "Brand / Merch";
  return "Print Shop";
}

export default function StoreModeManager({
  accountMode,
  platformAccess
}: {
  accountMode: ShopAccountMode;
  platformAccess: PlatformShopAccess;
}) {
  return (
    <div className="business-access-layout">
      <section className="admin-card access-overview">
        <p className="eyebrow">PRINTFLOW ACCESS</p>
        <h1>{label(platformAccess)}</h1>
        <p>Your PrintFlow account can contain one business workflow or both. When both are enabled, the two businesses share infrastructure but keep their merchandise, pricing, storefronts, and operating process separate.</p>
      </section>

      <div className="business-access-grid">
        {platformAccess.customPrint && (
          <article className="admin-card print-business-card">
            <span>PRODUCTION BUSINESS</span>
            <h2>Print Shop</h2>
            <p>For customers submitting artwork and ordering custom production.</p>
            <div>
              <strong>Own workflow</strong>
              <small>Products · print zones · custom artwork · production pricing · order storefront</small>
            </div>
            <div>
              <strong>Customer route</strong>
              <small>/s/[shop]</small>
            </div>
            <a className="primary-button" href="/dashboard">Open Print Shop</a>
          </article>
        )}

        {platformAccess.brandMerch && (
          <article className="admin-card brand-business-card">
            <span>RETAIL BUSINESS</span>
            <h2>Brand / Merch</h2>
            <p>For a Brand selling approved merchandise as finished retail products.</p>
            <div>
              <strong>Own workflow</strong>
              <small>Brand garments · design studio · products · retail economics · collections · Brand storefront</small>
            </div>
            <div>
              <strong>Customer routes</strong>
              <small>/b/[shop] · /e/[shop]</small>
            </div>
            <a className="primary-button" href="/dashboard/brand">Open Brand / Merch</a>
          </article>
        )}
      </div>

      {accountMode === "hybrid" && (
        <section className="admin-card hybrid-explainer">
          <span>HOW BOTH WORKS</span>
          <h2>One account. Two businesses.</h2>
          <div className="hybrid-flow">
            <div><strong>Shared Core</strong><small>Login · team · supplier credentials · payment credentials · account billing</small></div>
            <i>→</i>
            <div><strong>Print Shop</strong><small>Custom production business</small></div>
            <i>+</i>
            <div><strong>Brand / Merch</strong><small>Retail merchandise business</small></div>
          </div>
          <p>The workspace switcher in the sidebar changes which business you are operating. It does not turn the other business off and it does not copy pricing or merchandise settings between them.</p>
        </section>
      )}

      <style jsx>{`
        .business-access-layout{display:grid;gap:14px}.access-overview{padding:22px}.access-overview h1{margin:4px 0 7px}.access-overview>p:not(.eyebrow){max-width:820px;margin:0;color:#777;line-height:1.55}
        .business-access-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.business-access-grid article{display:grid;gap:12px;padding:20px}.business-access-grid article>span,.hybrid-explainer>span{font-size:7px;font-weight:850;letter-spacing:.11em;color:#777}.business-access-grid h2{margin:0;font-size:24px}.business-access-grid p{margin:0;color:#777;font-size:9px;line-height:1.5}.business-access-grid article>div{padding:10px;border-radius:9px;background:#f5f5f1}.business-access-grid strong,.business-access-grid small{display:block}.business-access-grid strong{font-size:9px}.business-access-grid small{margin-top:3px;color:#777;font-size:8px}.brand-business-card{border-top:4px solid #1f2947}.print-business-card{border-top:4px solid #171717}
        .hybrid-explainer{padding:20px}.hybrid-explainer h2{margin:4px 0 12px}.hybrid-flow{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;gap:8px;align-items:center}.hybrid-flow>div{padding:12px;border-radius:9px;background:#f5f5f1}.hybrid-flow strong,.hybrid-flow small{display:block}.hybrid-flow strong{font-size:9px}.hybrid-flow small{margin-top:3px;color:#777;font-size:7px}.hybrid-flow i{font-style:normal;color:#888}.hybrid-explainer>p{margin:12px 0 0;color:#777;font-size:8px}
        @media(max-width:760px){.business-access-grid{grid-template-columns:1fr}.hybrid-flow{grid-template-columns:1fr}.hybrid-flow i{display:none}}
      `}</style>
    </div>
  );
}
