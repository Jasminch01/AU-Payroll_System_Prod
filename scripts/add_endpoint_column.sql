-- Migration: Add endpoint column to push_subscriptions table
-- Table is empty, so this is a clean install — no data backfill needed.
-- Run this in your Supabase SQL Editor.

-- Step 1: Add the endpoint column (the push endpoint URL, unique per device)
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS endpoint TEXT;

-- Step 2: Add a unique constraint on (user_id, endpoint) to prevent duplicate device rows
ALTER TABLE push_subscriptions
  ADD CONSTRAINT push_subscriptions_user_endpoint_unique UNIQUE (user_id, endpoint);
