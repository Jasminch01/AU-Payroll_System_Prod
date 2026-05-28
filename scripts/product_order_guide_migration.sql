-- ============================================================
-- Deputy MVP — Product Order Guide / Category-Based Ordering
-- Migration: product_order_guide_migration.sql
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================
-- Tables:
--   1. "OrderSupplier"    — Supplier directory (no passwords stored)
--   2. "OrderCategory"   — Product/order groupings
--   3. "OrderGuideItem"  — Products inside each category
--   4. "DailyOrderTask"  — Per-day order execution records
--
-- Column added:
--   "User".can_order_liquor  — Owner-controlled liquor permission flag
--
-- NOTE: No RLS. All access control is handled server-side in
--       Next.js API routes using requireRole(). Supabase is used
--       purely as a database — service role key only on the server.
-- ============================================================


-- ============================================================
-- STEP 0: ENUM types (idempotent)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE ordering_method AS ENUM (
    'portal',    -- Supplier web portal (URL shown, no password stored)
    'phone',     -- Phone call to supplier
    'sms',       -- SMS order to supplier
    'email',     -- Email order to supplier
    'rep',       -- Sales rep visit
    'metcash'    -- Metcash/ALM ordering system (store computer)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE order_frequency AS ENUM (
    'daily',
    'weekly',
    'specific_days',
    'manual'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE stock_status AS ENUM (
    'enough',
    'low',
    'out_of_stock',
    'not_checked'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'pending',       -- Not yet actioned
    'ordered',       -- Order placed
    'not_required',  -- No order needed today
    'issue'          -- Could not order; reason required
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- STEP 1: "OrderSupplier" — Supplier directory
-- Portal passwords are NEVER stored. URL only for reference.
-- ============================================================

CREATE TABLE IF NOT EXISTS "OrderSupplier" (
  supplier_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        UUID        NOT NULL REFERENCES "Business"(business_id) ON DELETE CASCADE,
  supplier_name      TEXT        NOT NULL,
  contact_person     TEXT,
  phone              TEXT,
  email              TEXT,
  portal_url         TEXT,                   -- URL only, NO password field by design
  order_cutoff_time  TIME,                   -- e.g. 14:00
  delivery_days      TEXT[],                 -- e.g. ARRAY['Mon','Wed','Fri']
  ordering_method    ordering_method,
  notes              TEXT,
  is_active          BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE "OrderSupplier" IS 'Supplier directory. Portal passwords are never stored — URL only. Managers use the store computer or authorised login for portal orders.';
COMMENT ON COLUMN "OrderSupplier".portal_url IS 'Portal URL for reference only. Passwords must never be stored.';


-- ============================================================
-- STEP 2: "OrderCategory" — Product/order groupings
-- e.g. Fruit & Veg, Dairy & Milk, Bread, Liquor Key Items
-- ============================================================

CREATE TABLE IF NOT EXISTS "OrderCategory" (
  category_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id              UUID        NOT NULL REFERENCES "Business"(business_id) ON DELETE CASCADE,
  category_name            TEXT        NOT NULL,
  default_supplier_id      UUID        REFERENCES "OrderSupplier"(supplier_id) ON DELETE SET NULL,
  default_ordering_method  ordering_method,
  order_days               TEXT[],             -- e.g. ARRAY['Mon','Wed','Fri']
  cutoff_time              TIME,               -- Category-level cut-off override
  responsible_role         TEXT        NOT NULL DEFAULT 'manager',
  is_active                BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order               INTEGER     NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_order_category_name_business UNIQUE (business_id, category_name)
);

COMMENT ON TABLE "OrderCategory" IS 'Product/order groupings. Managers see categories first on Today''s Orders. Liquor Key Items access filtered in app layer via User.can_order_liquor.';
COMMENT ON COLUMN "OrderCategory".sort_order IS 'Display order on the Today''s Orders screen.';


-- ============================================================
-- STEP 3: "OrderGuideItem" — Products inside each category
-- ============================================================

CREATE TABLE IF NOT EXISTS "OrderGuideItem" (
  item_id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           UUID           NOT NULL REFERENCES "Business"(business_id) ON DELETE CASCADE,
  category_id           UUID           NOT NULL REFERENCES "OrderCategory"(category_id) ON DELETE CASCADE,
  supplier_id           UUID           REFERENCES "OrderSupplier"(supplier_id) ON DELETE SET NULL,
  product_name          TEXT           NOT NULL,

  -- Min/Max stock logic:
  --   Suggested Order Qty = max_stock_qty - current_stock_qty
  --   Ordering recommended only when current_stock_qty <= min_stock_qty
  min_stock_qty         NUMERIC(10,2)  NOT NULL DEFAULT 0,
  max_stock_qty         NUMERIC(10,2)  NOT NULL DEFAULT 0,
  default_order_qty     NUMERIC(10,2),         -- Fallback when no min/max applies

  unit                  TEXT           NOT NULL DEFAULT 'each',
  order_frequency       order_frequency NOT NULL DEFAULT 'daily',
  order_days            TEXT[],               -- Used when order_frequency = 'specific_days'
  ordering_method       ordering_method,      -- Overrides category default if set
  ordering_instruction  TEXT,                 -- How to order — safe, no passwords
  comment               TEXT,                 -- e.g. "Order more before weekends"
  is_active             BOOLEAN        NOT NULL DEFAULT TRUE,
  sort_order            INTEGER        NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_order_guide_item_min_max CHECK (max_stock_qty >= min_stock_qty)
);

COMMENT ON TABLE "OrderGuideItem" IS 'Products in the order guide. Suggested qty = max - current, recommended when current <= min.';
COMMENT ON COLUMN "OrderGuideItem".min_stock_qty IS 'Order is recommended when current stock is at or below this level.';
COMMENT ON COLUMN "OrderGuideItem".max_stock_qty IS 'Target stock level. Suggested order qty = max - current.';
COMMENT ON COLUMN "OrderGuideItem".ordering_instruction IS 'Safe ordering instruction. Never include passwords.';


-- ============================================================
-- STEP 4: "DailyOrderTask" — Daily order execution records
--
-- ordered_by → "User".user_id  (NOT Employee.employee_id)
-- Manager role only exists in the "User" table.
-- Product ordering is a manager/owner function only.
-- Access control enforced in Next.js API routes (requireRole).
-- ============================================================

CREATE TABLE IF NOT EXISTS "DailyOrderTask" (
  order_task_id      UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        UUID           NOT NULL REFERENCES "Business"(business_id) ON DELETE CASCADE,
  order_date         DATE           NOT NULL,
  category_id        UUID           NOT NULL REFERENCES "OrderCategory"(category_id) ON DELETE CASCADE,
  item_id            UUID           NOT NULL REFERENCES "OrderGuideItem"(item_id) ON DELETE CASCADE,
  supplier_id        UUID           REFERENCES "OrderSupplier"(supplier_id) ON DELETE SET NULL,

  suggested_qty      NUMERIC(10,2),           -- System-calculated at task generation time
  current_stock_qty  NUMERIC(10,2),           -- Entered by manager during stock check
  final_qty          NUMERIC(10,2),           -- Confirmed/adjusted by manager

  stock_status       stock_status   NOT NULL DEFAULT 'not_checked',
  order_status       order_status   NOT NULL DEFAULT 'pending',

  -- FK → "User".user_id (manager or owner who actioned this task)
  -- Manager role lives in User table, not Employee table
  ordered_by         UUID           REFERENCES "User"(user_id) ON DELETE SET NULL,
  ordered_at         TIMESTAMPTZ,

  comment_reason     TEXT,                    -- Required when order_status = 'issue'
  order_reference    TEXT,                    -- e.g. Metcash order #, email ref

  -- Linked to shift when triggered via checklist (auto-detected)
  shift_id           UUID           REFERENCES "Shift"(shift_id) ON DELETE SET NULL,

  created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  -- Idempotent: one task per product per day
  CONSTRAINT uq_daily_order_task_item_date UNIQUE (business_id, item_id, order_date),

  -- comment_reason is mandatory when status = 'issue'
  CONSTRAINT chk_daily_order_task_issue_reason
    CHECK (order_status != 'issue' OR (comment_reason IS NOT NULL AND comment_reason <> ''))
);

COMMENT ON TABLE "DailyOrderTask" IS 'Per-day order execution records. One row per product per day. Actioned by managers/owners only. ordered_by → User.user_id.';
COMMENT ON COLUMN "DailyOrderTask".ordered_by IS 'FK → User.user_id. Manager or owner who actioned this task. Regular employees cannot complete product orders.';
COMMENT ON COLUMN "DailyOrderTask".suggested_qty IS 'max_stock_qty - current_stock_qty. Set only when current_stock_qty <= min_stock_qty.';
COMMENT ON COLUMN "DailyOrderTask".comment_reason IS 'Mandatory when order_status = issue. Enforced by DB constraint.';
COMMENT ON COLUMN "DailyOrderTask".shift_id IS 'Links to a rostered shift. Auto-detected when shift checklist template category = ordering.';


-- ============================================================
-- STEP 5: Add can_order_liquor to "User" table
--
-- Lives on "User", NOT "Employee".
-- Manager role only exists in the User table.
-- Owner (role = owner) sets this to true for specific managers
-- to grant them access to the Liquor Key Items category.
-- Enforced in application layer (API route + UI filter).
-- ============================================================

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS can_order_liquor BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN "User".can_order_liquor IS 'Grants access to Liquor Key Items ordering. Only owner can set this to true for specific managers. Enforced in app layer.';


-- ============================================================
-- STEP 6: updated_at triggers
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_supplier_updated_at  ON "OrderSupplier";
CREATE TRIGGER trg_order_supplier_updated_at
  BEFORE UPDATE ON "OrderSupplier"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_order_category_updated_at  ON "OrderCategory";
CREATE TRIGGER trg_order_category_updated_at
  BEFORE UPDATE ON "OrderCategory"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_order_guide_item_updated_at ON "OrderGuideItem";
CREATE TRIGGER trg_order_guide_item_updated_at
  BEFORE UPDATE ON "OrderGuideItem"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_daily_order_task_updated_at ON "DailyOrderTask";
CREATE TRIGGER trg_daily_order_task_updated_at
  BEFORE UPDATE ON "DailyOrderTask"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- STEP 7: Performance Indexes
-- ============================================================

-- OrderSupplier
CREATE INDEX IF NOT EXISTS idx_order_supplier_business
  ON "OrderSupplier"(business_id, is_active);

-- OrderCategory
CREATE INDEX IF NOT EXISTS idx_order_category_business_active
  ON "OrderCategory"(business_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_order_category_supplier
  ON "OrderCategory"(default_supplier_id);

-- OrderGuideItem
CREATE INDEX IF NOT EXISTS idx_order_guide_item_category
  ON "OrderGuideItem"(category_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_order_guide_item_business
  ON "OrderGuideItem"(business_id, is_active);

CREATE INDEX IF NOT EXISTS idx_order_guide_item_supplier
  ON "OrderGuideItem"(supplier_id);

-- DailyOrderTask (most queried at runtime)
CREATE INDEX IF NOT EXISTS idx_daily_order_task_business_date
  ON "DailyOrderTask"(business_id, order_date);

CREATE INDEX IF NOT EXISTS idx_daily_order_task_category_date
  ON "DailyOrderTask"(category_id, order_date);

CREATE INDEX IF NOT EXISTS idx_daily_order_task_item_date
  ON "DailyOrderTask"(item_id, order_date);

CREATE INDEX IF NOT EXISTS idx_daily_order_task_status
  ON "DailyOrderTask"(business_id, order_date, order_status);

CREATE INDEX IF NOT EXISTS idx_daily_order_task_shift
  ON "DailyOrderTask"(shift_id)
  WHERE shift_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_daily_order_task_ordered_by
  ON "DailyOrderTask"(ordered_by)
  WHERE ordered_by IS NOT NULL;


-- ============================================================
-- STEP 8: Seed default categories (optional, run per business)
-- Replace <business_id> with actual UUID.
-- ============================================================
/*
INSERT INTO "OrderCategory"
  (business_id, category_name, order_days, responsible_role, sort_order)
VALUES
  ('<business_id>', 'Fruit & Veg',      ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], 'manager', 1),
  ('<business_id>', 'Dairy & Milk',      ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], 'manager', 2),
  ('<business_id>', 'Bread',             ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], 'manager', 3),
  ('<business_id>', 'Ready Meals',       ARRAY['Mon','Wed','Fri'],                         'manager', 4),
  ('<business_id>', 'Juice / Drinks',    ARRAY['Mon','Wed','Fri'],                         'manager', 5),
  ('<business_id>', 'Grocery Key Items', ARRAY['Mon','Wed','Fri'],                         'manager', 6),
  ('<business_id>', 'Liquor Key Items',  ARRAY['Mon','Wed','Fri'],                         'owner',   7)
ON CONFLICT (business_id, category_name) DO NOTHING;
*/


-- ============================================================
-- VERIFICATION QUERIES
--
-- 1. Tables created:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN ('OrderSupplier','OrderCategory','OrderGuideItem','DailyOrderTask');
--
-- 2. ordered_by FK → User (not Employee):
-- SELECT kcu.column_name, ccu.table_name AS references_table
-- FROM information_schema.table_constraints tc
--   JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
--   JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND tc.table_name = 'DailyOrderTask'
--   AND kcu.column_name = 'ordered_by';
-- Expected: references_table = 'User'
--
-- 3. can_order_liquor on User (not Employee):
-- SELECT table_name, column_name FROM information_schema.columns
-- WHERE column_name = 'can_order_liquor';
-- Expected: table_name = 'User'
-- ============================================================
