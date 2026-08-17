"use client";

import Link from "next/link";

type CompatibilityProps = {
  initial?: unknown;
};

/**
 * Compatibility shim for the previous Brand storefront editor.
 *
 * The current Two-Businesses architecture stores Brand identity and
 * storefront presentation in brand_business_profiles and manages those
 * values at /dashboard/brand-settings.
 *
 * This file intentionally remains in the repository so older references
 * cannot break TypeScript builds while the legacy component is phased out.
 */
export default function BrandStorefrontSettingsManager(_props: CompatibilityProps) {
  return (
    <section className="admin-card brand-storefront-legacy">
      <div>
        <p className="eyebrow">BRAND / MERCH</p>
        <h2>Brand storefront settings moved</h2>
        <p>
          Brand identity, storefront colors, messaging, and Brand-only
          publish status are now managed in Brand Settings.
        </p>
      </div>

      <Link className="primary-button" href="/dashboard/brand-settings">
        Open Brand Settings
      </Link>

      <style jsx>{`
        .brand-storefront-legacy {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 20px;
        }

        .brand-storefront-legacy h2 {
          margin: 3px 0 5px;
        }

        .brand-storefront-legacy p:not(.eyebrow) {
          max-width: 650px;
          margin: 0;
          color: #777;
          line-height: 1.5;
        }

        @media (max-width: 680px) {
          .brand-storefront-legacy {
            display: grid;
          }
        }
      `}</style>
    </section>
  );
}
