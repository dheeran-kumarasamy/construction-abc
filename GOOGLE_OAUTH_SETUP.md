# Google OAuth Implementation Guide

## Overview
Google OAuth authentication has been implemented for builder, architect, and dealer login. Users can now sign in using their Google accounts.

## Environment Configuration

### Required Environment Variables

#### Frontend (.env.local or .env)
Add the following to your frontend environment configuration:

```env
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
```

**To get your Google Client ID:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" and create an OAuth 2.0 Client ID
5. Set Authorized JavaScript origins:
   - `http://localhost:5173` (development)
   - `http://localhost:3000` (production)
   - `https://yourdomain.com` (production domain)
6. Set Authorized Redirect URIs:
   - `http://localhost:5173/login` (development)
   - `https://yourdomain.com/login` (production)
7. Copy the Client ID and add it to your environment

#### Backend (.env)
Ensure these variables are set:

```env
JWT_SECRET=your_jwt_secret_key
FRONTEND_URL=http://localhost:5173
DATABASE_URL=your_database_connection_url
```

## Database Schema

The migration automatically adds the `google_id` column to the users table:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
```

## How It Works

### User Flow

1. **New User with Google OAuth:**
   - User selects role (Architect, Builder, Dealer)
   - Clicks "Sign in with Google"
   - Google authenticates and provides profile
   - Backend creates new user account with the provided role
   - JWT token returned and user logged in
   - Redirected to appropriate dashboard

2. **Existing User with Google OAuth:**
   - If user email already exists in system, linked to existing account
   - Google ID stored in `users.google_id` column
   - JWT token returned
   - User logged in to their existing account

3. **Existing User with Email/Password:**
   - User can still use email/password login
   - On first Google login, system links their account if email matches
   - Google ID stored for future OAuth logins

### Backend Endpoints

**New OAuth Endpoints:**

- `POST /auth/oauth/google-callback` - Handle Google OAuth callback
  - Body: `{ profile: GoogleProfile, role: "architect" | "builder" | "dealer" }`
  - Returns: JWT token, user role, profile completion status

- `POST /auth/oauth/validate-token` - Validate JWT token
  - Header: `Authorization: Bearer {token}`
  - Returns: Token validity and decoded payload

### Frontend Components

**GoogleLoginButton.tsx**
- Displays "Sign in with Google" button
- Handles credential response from Google
- Calls backend OAuth endpoint
- Supports all three user roles (architect, builder, dealer)

**Login.tsx Updates**
- Added role selection for Google login
- Shows "or" separator between Google and email/password login
- Handles OAuth success flow
- Maintains backward compatibility with email/password login

**googleOAuth.ts Service**
- `handleGoogleOAuthCallback()` - Exchanges Google token for JWT
- `validateToken()` - Validates JWT tokens

## Database Changes

### Users Table Addition
```sql
google_id VARCHAR(255) UNIQUE -- Google user ID from OAuth
```

### Migration File
- `030_add_google_oauth.sql` - Adds Google OAuth support to database

## Features Supported

✅ Google login for Architect users
✅ Google login for Builder users
✅ Google login for Dealer/Supplier users
✅ New user account creation via Google OAuth
✅ Existing user linking with Google OAuth
✅ JWT token generation and validation
✅ Role-based redirects after login
✅ Builder profile setup flow for new builder users
✅ Email normalization and case-insensitive lookups

## Testing

### Local Testing

1. Ensure environment variables are set in `.env.local`
2. Start backend: `npm run dev` (backend folder)
3. Start frontend: `npm run dev` (frontend folder)
4. Navigate to login page
5. Select a role (Architect, Builder, or Supplier)
6. Click "Sign in with Google"
7. Authenticate with your Google account
8. Should redirect to appropriate dashboard

### Test Credentials

Use your personal Google account for testing. The system supports:
- Creating new accounts via Google OAuth
- Linking existing email/password accounts
- Auto-redirecting to appropriate dashboards based on role

## Troubleshooting

### "Invalid Client ID" Error
- Verify `VITE_GOOGLE_CLIENT_ID` is set correctly in .env.local
- Check that Google OAuth is enabled in Google Cloud Console
- Verify authorized redirect URIs are configured

### OAuth Callback Fails
- Ensure backend is accessible from frontend
- Check `/auth/oauth/google-callback` endpoint is working
- Verify JWT_SECRET is set in backend

### User Not Redirected to Dashboard
- Check browser console for errors
- Verify localStorage has token and role set
- Check AuthContext is properly wrapped with GoogleOAuthProvider

### Database Migration Failed
- Run `npm run migrate` in backend folder
- Check database connection
- Ensure migrations folder has proper permissions

## Security Notes

1. **Google Client ID**: Never expose in production code - use environment variables
2. **JWT Secret**: Keep secure and never share
3. **Google OAuth**: Validates credentials server-side with Google
4. **Email Storage**: Normalized to lowercase to prevent duplicate accounts
5. **Password**: OAuth users don't have password hashes unless they also set a password

## Future Enhancements

- [ ] OAuth for other roles (admin, client)
- [ ] Facebook/GitHub OAuth integration
- [ ] Social login account linking UI
- [ ] OAuth provider management in user settings
