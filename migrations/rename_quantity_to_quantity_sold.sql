-- Rename quantity column to quantity_sold in portfolio_sales for clarity
-- Migration Date: 2025-10-30
-- This makes the column name more descriptive and matches naming convention

ALTER TABLE portfolio_sales
RENAME COLUMN quantity TO quantity_sold;

-- Verify the change
-- \d portfolio_sales
