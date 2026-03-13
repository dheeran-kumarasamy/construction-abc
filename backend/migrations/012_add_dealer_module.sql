-- ============================================
-- Migration 012: Add Dealer Module
-- ============================================

-- 1️⃣ Update user role constraint to include 'dealer'
ALTER TABLE users
DROP CONSTRAINT users_role_check,
ADD CONSTRAINT users_role_check CHECK (role IN ('architect','builder','client','dealer'));

-- 2️⃣ Create dealers table
CREATE TABLE IF NOT EXISTS dealers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  shop_name VARCHAR(200) NOT NULL,
  location VARCHAR(300),
  contact_number VARCHAR(20),
  email VARCHAR(255) NOT NULL,
  city VARCHAR(100),
  state VARCHAR(100),
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approval_date TIMESTAMP,
  approved_by UUID REFERENCES users(id),
  
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_dealers_user ON dealers(user_id);
CREATE INDEX idx_dealers_organization ON dealers(organization_id);
CREATE INDEX idx_dealers_city ON dealers(city);
CREATE INDEX idx_dealers_is_approved ON dealers(is_approved);

-- 3️⃣ Create dealer_prices table
CREATE TABLE IF NOT EXISTS dealer_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  price DECIMAL(12, 2) NOT NULL CHECK (price > 0),
  minimum_quantity INT DEFAULT 1,
  unit_of_sale VARCHAR(50),
  notes TEXT,
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  version INT NOT NULL DEFAULT 1,
  
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_dealer_prices_dealer ON dealer_prices(dealer_id);
CREATE INDEX idx_dealer_prices_material ON dealer_prices(material_id);
CREATE INDEX idx_dealer_prices_dealer_material ON dealer_prices(dealer_id, material_id);
CREATE INDEX idx_dealer_prices_active ON dealer_prices(is_active);
CREATE UNIQUE INDEX idx_dealer_prices_unique ON dealer_prices(dealer_id, material_id) WHERE is_active = true;

-- 4️⃣ Create dealer_price_history table (for audit trail)
CREATE TABLE IF NOT EXISTS dealer_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_price_id UUID NOT NULL REFERENCES dealer_prices(id) ON DELETE CASCADE,
  previous_price DECIMAL(12, 2),
  new_price DECIMAL(12, 2) NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(id),
  change_reason VARCHAR(500),
  
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_dealer_price_history_dealer_price ON dealer_price_history(dealer_price_id);
CREATE INDEX idx_dealer_price_history_created ON dealer_price_history(created_at DESC);

-- 5️⃣ Update user_invites to support dealer role
-- The role check constraint in user_invites already references the check in users table,
-- so we need to update it if it exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'user_invites' AND constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE user_invites
    DROP CONSTRAINT user_invites_role_check;
    
    ALTER TABLE user_invites
    ADD CONSTRAINT user_invites_role_check 
    CHECK (role IN ('architect','builder','client','dealer'));
  END IF;
END $$;

-- 6️⃣ Create dealer_reviews table (for builders/architects to rate dealers)
CREATE TABLE IF NOT EXISTS dealer_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_dealer_reviews_dealer ON dealer_reviews(dealer_id);
CREATE INDEX idx_dealer_reviews_reviewer ON dealer_reviews(reviewer_id);
CREATE UNIQUE INDEX idx_dealer_reviews_unique ON dealer_reviews(dealer_id, reviewer_id);
