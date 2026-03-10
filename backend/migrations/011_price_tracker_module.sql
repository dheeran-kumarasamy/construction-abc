CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS districts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(120) NOT NULL UNIQUE,
  region VARCHAR(20) NOT NULL CHECK (region IN ('north', 'south', 'west', 'central')),
  lat DECIMAL(10, 7) NOT NULL,
  lng DECIMAL(10, 7) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS material_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(120) NOT NULL UNIQUE,
  icon VARCHAR(50) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES material_categories(id) ON DELETE CASCADE,
  name VARCHAR(180) NOT NULL,
  unit VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE(category_id, name)
);

CREATE TABLE IF NOT EXISTS price_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  district_id UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  price DECIMAL(12, 2) NOT NULL CHECK (price > 0),
  source VARCHAR(120) NOT NULL,
  scraped_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  flagged BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS flagged_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  district_id UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  previous_price DECIMAL(12, 2) NOT NULL,
  new_price DECIMAL(12, 2) NOT NULL,
  diff_ratio DECIMAL(8, 4) NOT NULL,
  source VARCHAR(120) NOT NULL,
  scraped_at TIMESTAMP NOT NULL,
  raw_snapshot_path TEXT,
  review_status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  district_id UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  condition VARCHAR(10) NOT NULL CHECK (condition IN ('above', 'below')),
  threshold DECIMAL(12, 2) NOT NULL CHECK (threshold > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  district_id UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(user_id, district_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_records_material_district_scraped
  ON price_records(material_id, district_id, scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_records_district_material
  ON price_records(district_id, material_id);

CREATE INDEX IF NOT EXISTS idx_price_alerts_lookup
  ON price_alerts(material_id, district_id, is_active);

CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user
  ON user_bookmarks(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications(user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_flagged_prices_created
  ON flagged_prices(created_at DESC);
