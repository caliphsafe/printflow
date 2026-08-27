/* SOURCE-CONTROL COPY ONLY FOR THIS INSTALLATION.
   The Advanced commerce foundation was already applied successfully in Supabase on 2026-08-27.
   This file records the database state in GitHub. It is intentionally additive/idempotent for tables/indexes,
   but policy names may already exist on the live project, so do not blindly rerun it there. */

BEGIN;

CREATE TABLE IF NOT EXISTS public.catalog_product_sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    catalog_product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
    supplier_style_id uuid NOT NULL REFERENCES public.supplier_catalog_styles(id) ON DELETE RESTRICT,
    provider text NOT NULL,
    priority integer NOT NULL DEFAULT 1,
    active boolean NOT NULL DEFAULT true,
    configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (catalog_product_id, supplier_style_id)
);
CREATE INDEX IF NOT EXISTS catalog_product_sources_shop_idx ON public.catalog_product_sources(shop_id);
CREATE INDEX IF NOT EXISTS catalog_product_sources_product_idx ON public.catalog_product_sources(catalog_product_id);

CREATE TABLE IF NOT EXISTS public.storefronts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    name text NOT NULL,
    slug text NOT NULL,
    storefront_type text NOT NULL DEFAULT 'general',
    description text,
    active boolean NOT NULL DEFAULT true,
    settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (shop_id, slug),
    CHECK (storefront_type IN ('general','school','company','team','event'))
);
CREATE INDEX IF NOT EXISTS storefronts_shop_idx ON public.storefronts(shop_id);

CREATE TABLE IF NOT EXISTS public.storefront_products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    storefront_id uuid NOT NULL REFERENCES public.storefronts(id) ON DELETE CASCADE,
    catalog_product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE RESTRICT,
    name_override text,
    description_override text,
    price numeric(12,2),
    configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
    active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (storefront_id, catalog_product_id)
);
CREATE INDEX IF NOT EXISTS storefront_products_storefront_idx ON public.storefront_products(storefront_id);

CREATE TABLE IF NOT EXISTS public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    display_id text NOT NULL,
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    storefront_id uuid REFERENCES public.storefronts(id) ON DELETE SET NULL,
    channel text NOT NULL DEFAULT 'custom',
    status text NOT NULL DEFAULT 'draft',
    payment_status text NOT NULL DEFAULT 'not_started',
    currency text NOT NULL DEFAULT 'usd',
    subtotal numeric(12,2) NOT NULL DEFAULT 0,
    tax_amount numeric(12,2) NOT NULL DEFAULT 0,
    rush_fee numeric(12,2) NOT NULL DEFAULT 0,
    discount_amount numeric(12,2) NOT NULL DEFAULT 0,
    total numeric(12,2) NOT NULL DEFAULT 0,
    customer_name_snapshot text,
    customer_email_snapshot text,
    customer_phone_snapshot text,
    requested_due_date date,
    notes text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    submitted_at timestamptz,
    paid_at timestamptz,
    completed_at timestamptz,
    UNIQUE (shop_id, display_id),
    CHECK (channel IN ('custom','storefront','manual','quote','reorder')),
    CHECK (status IN ('draft','awaiting_payment','paid','artwork_review','awaiting_approval','approved','ready_for_production','in_production','quality_control','ready','shipped','completed','cancelled','failed')),
    CHECK (payment_status IN ('not_started','pending','paid','partially_refunded','refunded','failed','cancelled'))
);
CREATE INDEX IF NOT EXISTS orders_shop_idx ON public.orders(shop_id);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS orders_storefront_idx ON public.orders(storefront_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders(shop_id,status);

CREATE TABLE IF NOT EXISTS public.order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    catalog_product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL,
    design_id uuid REFERENCES public.designs(id) ON DELETE SET NULL,
    supplier_style_id uuid REFERENCES public.supplier_catalog_styles(id) ON DELETE SET NULL,
    product_name_snapshot text NOT NULL,
    supplier_provider text,
    supplier_style_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    color_name text,
    decoration_method text,
    decoration_location text,
    quantity integer NOT NULL DEFAULT 1,
    garment_subtotal numeric(12,2) NOT NULL DEFAULT 0,
    decoration_subtotal numeric(12,2) NOT NULL DEFAULT 0,
    setup_fee numeric(12,2) NOT NULL DEFAULT 0,
    line_total numeric(12,2) NOT NULL DEFAULT 0,
    configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (quantity > 0)
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items(order_id);

CREATE TABLE IF NOT EXISTS public.order_item_quantities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
    supplier_variant_id uuid REFERENCES public.supplier_catalog_variants(id) ON DELETE SET NULL,
    size_name text NOT NULL,
    quantity integer NOT NULL,
    supplier_sku_snapshot text,
    unit_cost_snapshot numeric(12,2),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (quantity > 0)
);
CREATE INDEX IF NOT EXISTS order_item_quantities_item_idx ON public.order_item_quantities(order_item_id);

CREATE TABLE IF NOT EXISTS public.payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    provider text NOT NULL,
    provider_order_id text,
    provider_payment_id text,
    amount numeric(12,2) NOT NULL,
    currency text NOT NULL DEFAULT 'usd',
    status text NOT NULL DEFAULT 'pending',
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    paid_at timestamptz,
    CHECK (provider IN ('square','stripe','manual')),
    CHECK (status IN ('pending','authorized','paid','failed','cancelled','partially_refunded','refunded'))
);
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_payment_unique ON public.payments(provider,provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payments_order_idx ON public.payments(order_id);

CREATE TABLE IF NOT EXISTS public.order_status_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    from_status text,
    to_status text NOT NULL,
    changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    note text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_status_history_order_idx ON public.order_status_history(order_id,created_at);

ALTER TABLE public.catalog_product_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefronts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_quantities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='catalog_product_sources' AND policyname='Members manage catalog product sources') THEN
    CREATE POLICY "Members manage catalog product sources" ON public.catalog_product_sources FOR ALL TO authenticated USING (is_organization_member(organization_id)) WITH CHECK (is_organization_member(organization_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='storefronts' AND policyname='Members manage storefronts') THEN
    CREATE POLICY "Members manage storefronts" ON public.storefronts FOR ALL TO authenticated USING (is_organization_member(organization_id)) WITH CHECK (is_organization_member(organization_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='storefronts' AND policyname='Public reads active storefronts') THEN
    CREATE POLICY "Public reads active storefronts" ON public.storefronts FOR SELECT TO anon, authenticated USING (active=true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='storefront_products' AND policyname='Members manage storefront products') THEN
    CREATE POLICY "Members manage storefront products" ON public.storefront_products FOR ALL TO authenticated USING (is_organization_member(organization_id)) WITH CHECK (is_organization_member(organization_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='storefront_products' AND policyname='Public reads active storefront products') THEN
    CREATE POLICY "Public reads active storefront products" ON public.storefront_products FOR SELECT TO anon, authenticated USING (active=true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND policyname='Members manage orders') THEN
    CREATE POLICY "Members manage orders" ON public.orders FOR ALL TO authenticated USING (is_organization_member(organization_id)) WITH CHECK (is_organization_member(organization_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='order_items' AND policyname='Members manage order items') THEN
    CREATE POLICY "Members manage order items" ON public.order_items FOR ALL TO authenticated USING (is_organization_member(organization_id)) WITH CHECK (is_organization_member(organization_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='order_item_quantities' AND policyname='Members manage order item quantities') THEN
    CREATE POLICY "Members manage order item quantities" ON public.order_item_quantities FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.id=order_item_quantities.order_item_id AND is_organization_member(oi.organization_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.id=order_item_quantities.order_item_id AND is_organization_member(oi.organization_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payments' AND policyname='Members read payments') THEN
    CREATE POLICY "Members read payments" ON public.payments FOR SELECT TO authenticated USING (is_organization_member(organization_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='order_status_history' AND policyname='Members manage order status history') THEN
    CREATE POLICY "Members manage order status history" ON public.order_status_history FOR ALL TO authenticated USING (is_organization_member(organization_id)) WITH CHECK (is_organization_member(organization_id));
  END IF;
END $$;

COMMIT;
