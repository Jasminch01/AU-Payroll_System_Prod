-- ============================================================
-- Deputy MVP — Checklist Template Sort Order
-- Migration: add_checklist_template_sort_order.sql
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================
-- Purpose:
--   Add sort_order column to ChecklistTemplate table to persist
--   drag-and-drop reordering across page refreshes.
--
-- NOTE: This migration:
--   1. Adds sort_order column with default 0
--   2. Updates existing templates with unique sort_order values
--   3. Adds indexes for efficient querying by (business_id, category, sort_order)
-- ============================================================

-- STEP 1: Add sort_order column to ChecklistTemplate
ALTER TABLE "ChecklistTemplate"
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- STEP 2: Populate sort_order for existing templates
-- Group by business_id and category, then assign incremental sort_order
WITH ranked AS (
  SELECT 
    template_id,
    ROW_NUMBER() OVER (PARTITION BY business_id, category ORDER BY created_at ASC) as new_sort_order
  FROM "ChecklistTemplate"
)
UPDATE "ChecklistTemplate" ct
SET sort_order = ranked.new_sort_order
FROM ranked
WHERE ct.template_id = ranked.template_id
AND ct.sort_order = 0;

-- STEP 3: Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_checklist_template_business_category_sort
ON "ChecklistTemplate"(business_id, category, sort_order);

-- STEP 4: Optional - Add check constraint to ensure sort_order is non-negative
ALTER TABLE "ChecklistTemplate"
ADD CONSTRAINT check_sort_order_positive CHECK (sort_order >= 0);

-- Confirmation message
SELECT 'Migration completed: sort_order column added to ChecklistTemplate' as status;
