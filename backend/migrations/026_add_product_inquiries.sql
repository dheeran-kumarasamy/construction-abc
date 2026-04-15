-- ============================================
-- Migration 026: Product inquiries for dealer pricing
-- Normal users can request dealer prices for district products.
-- Admin can review and resolve inquiries.
-- ============================================

CREATE TABLE IF NOT EXISTS product_inquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  district_id UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  requested_quantity DECIMAL(12, 2) NOT NULL CHECK (requested_quantity > 0),
  specification TEXT NOT NULL,
  requested_location TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  admin_notes TEXT,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_inquiries_created
  ON product_inquiries(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_inquiries_status
  ON product_inquiries(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_inquiries_user
  ON product_inquiries(user_id, created_at DESC);