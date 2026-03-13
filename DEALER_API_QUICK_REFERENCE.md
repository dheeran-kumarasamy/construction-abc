# Local Dealer Module - Quick API Reference

## Base URL
```
http://localhost:5000/api/prices/dealers
```

## Authentication
All endpoints (except public list) require:
```
Authorization: Bearer {jwt_token}
```

## Key Endpoints

### Registration
```bash
POST /auth/register
Body: {
  "email": "dealer@shop.com",
  "password": "secure123",
  "role": "dealer",
  "dealerData": {
    "shopName": "Shop Name",
    "location": "Address",
    "contactNumber": "9999999999",
    "city": "City",
    "state": "State"
  }
}
```

### Profile Management
```bash
POST   /api/prices/dealers/profile        # Create profile
GET    /api/prices/dealers/profile        # Get your profile
PUT    /api/prices/dealers/profile        # Update profile
GET    /api/prices/dealers/list           # List all approved dealers
GET    /api/prices/dealers/list/city/:city # Dealers in city
GET    /api/prices/dealers/:dealerId     # Get specific dealer
```

### Price Management
```bash
POST   /api/prices/dealers/prices/set          # Set price for material
GET    /api/prices/dealers/prices              # Get all your prices
POST   /api/prices/dealers/prices/bulk         # Bulk set prices
GET    /api/prices/dealers/prices/material/:materialId  # Get all dealer prices for material
GET    /api/prices/dealers/prices/:priceId/history     # Get price history
DELETE /api/prices/dealers/prices/:priceId    # Deactivate price
```

### Market Comparison
```bash
GET /api/prices/material/:materialId/comparison
Query: ?location=Mumbai
# Returns market prices + all dealer prices combined
```

## Common Materials and UUIDs

Common materials you'll need (get actual UUIDs from /api/prices/categories):
- Cement
- Steel/Reinforcement
- Bricks
- Sand
- Wood
- Concrete
- Tiles

## Testing

### 1. Dealer Registration
```bash
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.dealer@gmail.com",
    "password": "test123",
    "role": "dealer",
    "dealerData": {
      "shopName": "Test Materials Pvt Ltd",
      "location": "123 Market Street",
      "contactNumber": "+91-9999999999",
      "city": "Mumbai",
      "state": "Maharashtra"
    }
  }'
```

### 2. Get Materials List
```bash
curl http://localhost:5000/api/prices/categories | jq
```

### 3. Add Prices (use token from registration)
```bash
curl -X POST http://localhost:5000/api/prices/dealers/prices/bulk \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "prices": [
      {
        "materialId": "CEMENT_UUID_HERE",
        "price": 450,
        "minimumQuantity": 50,
        "notes": "Premium grade"
      }
    ]
  }'
```

### 4. View Your Prices
```bash
curl http://localhost:5000/api/prices/dealers/prices \
  -H "Authorization: Bearer {token}"
```

### 5. Compare Prices
```bash
curl "http://localhost:5000/api/prices/material/CEMENT_UUID/comparison?location=Mumbai"
```

## Error Responses

### 401 Unauthorized
```json
{"error": "Unauthorized"}
```

### 400 Bad Request
```json
{"error": "shopName and email are required"}
```

### 404 Not Found
```json
{"error": "Dealer profile not found"}
```

### 409 Conflict
```json
{"error": "User already exists with this email"}
```

## Environment Variables
Make sure these are set in your .env:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT signing
- `PORT` - Server port (default 5000)

## Notes
- Dealers must be approved by admin to have their prices visible to builders
- Price history automatically tracked on updates
- Prices can be deactivated (soft delete) without losing history
- Bulk operations return success/failure count for each price
