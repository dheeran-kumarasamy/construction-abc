-- Add column_mapping field to store architect's confirmed field mappings
ALTER TABLE boqs 
ADD COLUMN column_mapping JSONB;

-- Store mapping as: {"item": "Description", "qty": "Quantity", "uom": "Unit", "rate": "Rate"}
