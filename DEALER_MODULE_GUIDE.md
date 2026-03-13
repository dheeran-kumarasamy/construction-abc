# Local Dealer Module - Implementation Guide

## Overview

The Local Dealer Module allows local dealers to register, login, and provide material prices for construction items like cement, steel, bricks, wood, etc. Builders and architects can then view and compare dealer prices with market prices.

## Features

### For Dealers
- **Self-Registration**: Dealers can register with their shop details (name, location, contact number, etc.)
- **Price Management**: Add, update, and manage prices for materials
- **Bulk Price Upload**: Set multiple material prices at once
- **Price History**: Track price changes over time
- **Profile Management**: Update shop information anytime

### For Builders/Architects
- **View Dealer Prices**: See prices from approved local dealers
- **Price Comparison**: Compare market prices with dealer prices
- **Location-based Search**: Filter dealers by city/state
- **Integrate in BOQ**: Use dealer prices when creating estimates

## User Roles

The system now supports 4 user roles:
- **architect**: Design professionals who create projects
- **builder**: Construction professionals who estimate costs
- **client**: Project owners
- **dealer**: Local material suppliers

## Database Schema

### Tables Created

1. **dealers**
   - `id`: UUID (Primary Key)
   - `user_id`: UUID (References users.id)
   - `shop_name`: Dealer's store name
   - `location`: Physical address
   - `contact_number`: Phone number
   - `email`: Contact email
   - `city`: City location
   - `state`: State/Province
   - `is_approved`: Admin approval status (default: false)
   - `approval_date`: When dealer was approved
   - `approved_by`: Admin user who approved
   - `created_at`, `updated_at`: Timestamps

2. **dealer_prices**
   - `id`: UUID (Primary Key)
   - `dealer_id`: UUID (References dealers.id)
   - `material_id`: UUID (References materials.id)
   - `price`: Decimal price per unit
   - `minimum_quantity`: Minimum order quantity
   - `unit_of_sale`: Custom unit if different from material unit
   - `notes`: Additional notes about the price
   - `is_active`: Active/inactive status
   - `version`: Price version number for tracking changes
   - `created_at`, `updated_at`: Timestamps

3. **dealer_price_history**
   - `id`: UUID (Primary Key)
   - `dealer_price_id`: UUID (References dealer_prices.id)
   - `previous_price`: Previous price value
   - `new_price`: New price value
   - `changed_by`: User who made the change
   - `change_reason`: Reason for change
   - `created_at`: When change was made

4. **dealer_reviews** (Optional)
   - `id`: UUID (Primary Key)
   - `dealer_id`: UUID (References dealers.id)
   - `reviewer_id`: UUID (References users.id)
   - `rating`: 1-5 star rating
   - `comment`: Review text
   - `created_at`, `updated_at`: Timestamps

## API Endpoints

### Authentication

#### Dealer Registration
```
POST /auth/register
Content-Type: application/json

{
  "email": "dealer@example.com",
  "password": "secure_password",
  "role": "dealer",
  "dealerData": {
    "shopName": "ABC Building Materials",
    "location": "123 Commerce Street",
    "contactNumber": "+91-9999999999",
    "city": "Mumbai",
    "state": "Maharashtra"
  }
}

Response: 201 Created
{
  "token": "jwt_token_here",
  "role": "dealer"
}
```

#### Dealer Login
```
POST /auth/login
Content-Type: application/json

{
  "email": "dealer@example.com",
  "password": "secure_password"
}

Response: 200 OK
{
  "token": "jwt_token_here",
  "role": "dealer"
}
```

### Dealer Profile Management

#### Create/Initialize Dealer Profile
```
POST /api/prices/dealers/profile
Authorization: Bearer {token}
Content-Type: application/json

{
  "shopName": "ABC Building Materials",
  "email": "contact@abc.com",
  "location": "123 Commerce Street",
  "contactNumber": "+91-9999999999",
  "city": "Mumbai",
  "state": "Maharashtra",
  "organizationId": "optional-org-uuid"
}

Response: 201 Created
{
  "id": "dealer-uuid",
  "userId": "user-uuid",
  "shopName": "ABC Building Materials",
  "email": "contact@abc.com",
  "location": "123 Commerce Street",
  "contactNumber": "+91-9999999999",
  "city": "Mumbai",
  "state": "Maharashtra",
  "isApproved": false,
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

#### Get Own Profile
```
GET /api/prices/dealers/profile
Authorization: Bearer {token}

Response: 200 OK
{
  "id": "dealer-uuid",
  "shopName": "ABC Building Materials",
  ...
}
```

#### Update Profile
```
PUT /api/prices/dealers/profile
Authorization: Bearer {token}
Content-Type: application/json

{
  "shopName": "Updated Shop Name",
  "contactNumber": "+91-8888888888",
  "location": "456 New Street"
}

Response: 200 OK
{
  "id": "dealer-uuid",
  "shopName": "Updated Shop Name",
  ...
}
```

#### List All Approved Dealers
```
GET /api/prices/dealers/list

Response: 200 OK
[
  {
    "id": "dealer-uuid",
    "shopName": "ABC Building Materials",
    "city": "Mumbai",
    "state": "Maharashtra",
    "isApproved": true,
    ...
  },
  ...
]
```

#### Get Dealers by City
```
GET /api/prices/dealers/list/city/{city}

Response: 200 OK
[
  {
    "id": "dealer-uuid",
    "shopName": "ABC Building Materials",
    "city": "Mumbai",
    ...
  }
]
```

#### Get Specific Dealer
```
GET /api/prices/dealers/{dealerId}

Response: 200 OK
{
  "id": "dealer-uuid",
  "shopName": "ABC Building Materials",
  ...
}
```

### Material Price Management

#### Set Price for Material
```
POST /api/prices/dealers/prices/set
Authorization: Bearer {token}
Content-Type: application/json

{
  "materialId": "material-uuid",
  "price": 450.50,
  "minimumQuantity": 50,
  "unitOfSale": "bags",
  "notes": "Available in bulk quantities"
}

Response: 201 Created
{
  "id": "dealer-price-uuid",
  "dealerId": "dealer-uuid",
  "materialId": "material-uuid",
  "materialName": "Cement",
  "categoryName": "Binders",
  "unit": "bags",
  "price": 450.50,
  "minimumQuantity": 50,
  "unitOfSale": "bags",
  "notes": "Available in bulk quantities",
  "isActive": true,
  "version": 1,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

#### Get All Own Prices
```
GET /api/prices/dealers/prices
Authorization: Bearer {token}
Query Parameters:
  - onlyActive: true/false (default: true)

Response: 200 OK
[
  {
    "id": "dealer-price-uuid",
    "materialName": "Cement",
    "categoryName": "Binders",
    "price": 450.50,
    ...
  },
  {
    "id": "dealer-price-uuid",
    "materialName": "Steel",
    "categoryName": "Reinforcement",
    "price": 65.00,
    ...
  }
]
```

#### Bulk Set Prices
```
POST /api/prices/dealers/prices/bulk
Authorization: Bearer {token}
Content-Type: application/json

{
  "prices": [
    {
      "materialId": "cement-uuid",
      "price": 450,
      "minimumQuantity": 50
    },
    {
      "materialId": "steel-uuid",
      "price": 65,
      "minimumQuantity": 100
    },
    {
      "materialId": "bricks-uuid",
      "price": 8,
      "minimumQuantity": 5000
    }
  ]
}

Response: 200 OK
{
  "success": 3,
  "failed": 0,
  "results": [
    { "id": "price-uuid1", "materialName": "Cement", ... },
    { "id": "price-uuid2", "materialName": "Steel", ... },
    { "id": "price-uuid3", "materialName": "Bricks", ... }
  ]
}
```

#### Get Prices for Material (Multi-Dealer)
```
GET /api/prices/dealers/prices/material/{materialId}
Query Parameters:
  - city: Filter by city (optional)

Response: 200 OK
[
  {
    "id": "dealer-price-uuid",
    "dealerId": "dealer-uuid",
    "materialId": "material-uuid",
    "materialName": "Cement",
    "price": 450,
    ...
  },
  {
    "id": "dealer-price-uuid",
    "dealerId": "dealer-uuid2",
    "materialName": "Cement",
    "price": 460,
    ...
  }
]
```

#### Get Price History
```
GET /api/prices/dealers/prices/{priceId}/history
Authorization: Bearer {token}

Response: 200 OK
[
  {
    "id": "history-uuid",
    "dealerPriceId": "dealer-price-uuid",
    "previousPrice": 440,
    "newPrice": 450,
    "changedBy": "dealer-user-uuid",
    "changeReason": "Market rate adjustment",
    "createdAt": "2025-01-15T10:30:00.000Z"
  }
]
```

#### Deactivate Price
```
DELETE /api/prices/dealers/prices/{priceId}
Authorization: Bearer {token}

Response: 200 OK
{
  "message": "Price deactivated successfully"
}
```

### Market Price Comparison

#### Get Material with Market & Dealer Prices
```
GET /api/prices/material/{materialId}/comparison
Query Parameters:
  - location: Filter by location/city (optional)

Response: 200 OK
{
  "marketPrices": [
    {
      "sourceType": "market",
      "location": "Mumbai",
      "region": "west",
      "price": 400,
      "source": "BuildingMart",
      "scrapedAt": "2025-01-15T09:00:00.000Z"
    }
  ],
  "dealerPrices": [
    {
      "sourceType": "dealer",
      "location": "ABC Building Materials",
      "locationDetail": "Mumbai",
      "price": 450,
      "dealerId": "dealer-uuid",
      "lastUpdated": "2025-01-15T10:30:00.000Z"
    }
  ],
  "combined": [
    {
      "sourceType": "market",
      "price": 400,
      ...
    },
    {
      "sourceType": "dealer",
      "price": 450,
      ...
    }
  ]
}
```

## Workflow Examples

### Example 1: Dealer Registration and Price Setup

```bash
# 1. Dealer registers
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dealer@abc.com",
    "password": "secure123",
    "role": "dealer",
    "dealerData": {
      "shopName": "ABC Building Materials",
      "location": "123 Commerce St, Mumbai",
      "contactNumber": "+91-9999999999",
      "city": "Mumbai",
      "state": "Maharashtra"
    }
  }'

# Response: { "token": "jwt_token", "role": "dealer" }

# 2. Dealer adds multiple material prices
curl -X POST http://localhost:5000/api/prices/dealers/prices/bulk \
  -H "Authorization: Bearer jwt_token" \
  -H "Content-Type: application/json" \
  -d '{
    "prices": [
      {
        "materialId": "cement-uuid",
        "price": 450,
        "minimumQuantity": 50,
        "notes": "Premium brand"
      },
      {
        "materialId": "steel-uuid",
        "price": 65,
        "minimumQuantity": 100
      },
      {
        "materialId": "bricks-uuid",
        "price": 8,
        "minimumQuantity": 5000
      }
    ]
  }'

# 3. Admin approves dealer profile
curl -X POST http://localhost:5000/api/prices/dealers/admin/approve \
  -H "Authorization: Bearer admin_token" \
  -H "Content-Type: application/json" \
  -d '{ "dealerId": "dealer-uuid" }'
```

### Example 2: Builder Comparing Prices

```bash
# 1. Get material prices from all approved dealers + market
curl "http://localhost:5000/api/prices/material/cement-uuid/comparison?location=Mumbai"

# Response includes both market and dealer prices, sorted by price

# 2. View specific dealer's profile and all prices
curl "http://localhost:5000/api/prices/dealers/dealer-uuid"
curl -H "Authorization: Bearer builder_token" \
  "http://localhost:5000/api/prices/dealers/list/city/Mumbai"

# 3. Use in BOQ estimation - select best price for cement
# (Integrate price selection in estimation module)
```

## Admin Operations

### Approve New Dealer
```
POST /api/prices/dealers/admin/approve
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "dealerId": "dealer-uuid"
}

Response: 200 OK
{
  "id": "dealer-uuid",
  "isApproved": true,
  "approvalDate": "2025-01-15T10:30:00.000Z",
  "approvedBy": "admin-user-uuid"
}
```

## Implementation Checklist

- [x] Database migration creating dealer tables
- [x] Dealer service with CRUD operations
- [x] Dealer authentication and registration
- [x] Dealer profile management endpoints
- [x] Price setting and management endpoints
- [x] Price history tracking
- [x] Market + dealer price comparison
- [ ] Frontend dealer registration page
- [ ] Frontend dealer dashboard
- [ ] Frontend price management UI
- [ ] Frontend dealer list and filter
- [ ] Admin approval panel for new dealers
- [ ] Email notifications to dealers on approval
- [ ] Dealer rating/review system
- [ ] Analytics and reporting for dealers

## Security Considerations

1. **Authentication**: All dealer endpoints (except list) require JWT authentication
2. **Authorization**: Dealers can only manage their own prices and profile
3. **Price Approval**: Not yet implemented - currently dealers can set any price (consider adding price moderation)
4. **Rate Limiting**: Should be added to prevent spam price updates
5. **Data Validation**: All inputs validated on backend
6. **Password Security**: Minimum 6 characters, hashed with bcrypt

## Future Enhancements

1. **Price Approval Workflow**: Admin review of new/changed prices before visibility
2. **Dealer Ratings**: Builders/architects can rate dealers
3. **Bulk Dealer Onboarding**: Admin can bulk import dealers
4. **Price Trends**: Show dealer price trends over time
5. **Notifications**: Alert dealers when competitors change prices
6. **Regional Pricing**: Support for zone-based pricing
7. **Integration with Projects**: Auto-suggest dealer prices in project estimation
8. **Payment Integration**: Handle dealer payments/commissions
9. **Dealer Analytics**: Track performance metrics for each dealer
10. **SMS Alerts**: Notify when prices change significantly

## Contact Support

For issues or questions about the dealer module, contact the development team.
