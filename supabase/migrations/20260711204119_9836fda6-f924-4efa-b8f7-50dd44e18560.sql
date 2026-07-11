
-- ============ ORDERS ============
CREATE TYPE public.order_status AS ENUM ('pending_payment','paid','preparing','shipped','delivered','cancelled','refunded');

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  order_number text NOT NULL UNIQUE,
  public_token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
  status public.order_status NOT NULL DEFAULT 'pending_payment',
  customer_name text,
  customer_email text,
  customer_phone text,
  shipping_address text,
  total_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'XOF',
  merchant_note text,
  customer_note text,
  metadata jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_business_idx ON public.orders(business_id);
CREATE INDEX orders_status_idx ON public.orders(status);
CREATE INDEX orders_created_desc_idx ON public.orders(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT ON public.orders TO anon;
GRANT ALL ON public.orders TO service_role;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads own orders" ON public.orders FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = orders.business_id AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE POLICY "owner updates own orders" ON public.orders FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = orders.business_id AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = orders.business_id AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ORDER ITEMS ============
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_items_order_idx ON public.order_items(order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT SELECT ON public.order_items TO anon;
GRANT ALL ON public.order_items TO service_role;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads own order items" ON public.order_items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o JOIN public.businesses b ON b.id = o.business_id
  WHERE o.id = order_items.order_id AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
));

-- ============ BUSINESS POSTS ============
CREATE TABLE public.business_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  image_url text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX business_posts_business_idx ON public.business_posts(business_id);
CREATE INDEX business_posts_published_idx ON public.business_posts(business_id, published, published_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_posts TO authenticated;
GRANT ALL ON public.business_posts TO service_role;

ALTER TABLE public.business_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages own posts" ON public.business_posts FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_posts.business_id AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_posts.business_id AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TRIGGER business_posts_set_updated_at BEFORE UPDATE ON public.business_posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ LINK PAYMENT -> ORDER ============
ALTER TABLE public.payment_link_payments ADD COLUMN order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;
CREATE INDEX payment_link_payments_order_idx ON public.payment_link_payments(order_id);

-- ============ Helper: order_number sequence ============
CREATE SEQUENCE IF NOT EXISTS public.orders_number_seq START 1000;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text LANGUAGE sql SET search_path = public
AS $$ SELECT 'CMD-' || to_char(now(),'YYMMDD') || '-' || lpad(nextval('public.orders_number_seq')::text, 5, '0') $$;
