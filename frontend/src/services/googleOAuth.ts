import { apiUrl } from "./api";
import { jwtDecode } from "jwt-decode";
import type { Role, OrgRole, AdminRole } from "../auth/AuthContext";

export interface GoogleOAuthResult {
  token: string;
  role: Role;
  orgRole?: OrgRole | null;
  adminRole?: AdminRole | null;
  profileComplete?: boolean;
  email: string;
  isNewUser: boolean;
  needsProfileSetup?: boolean;
}

/**
 * Handle Google OAuth callback - exchange Google token for JWT
 */
export async function handleGoogleOAuthCallback(
  googleToken: string,
  role: "architect" | "builder" | "dealer"
): Promise<GoogleOAuthResult> {
  try {
    // Decode the Google ID token to get user profile
    const decoded = jwtDecode(googleToken) as any;

    const profile = {
      id: decoded.sub,
      displayName: decoded.name,
      emails: [{ value: decoded.email }],
      photos: decoded.picture ? [{ value: decoded.picture }] : [],
    };

    // Send to backend OAuth endpoint
    const response = await fetch(apiUrl("/auth/oauth/google-callback"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ profile, role }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "OAuth callback failed");
    }

    return data;
  } catch (err: any) {
    throw new Error(err.message || "Failed to handle Google OAuth callback");
  }
}

/**
 * Validate a JWT token
 */
export async function validateToken(token: string): Promise<any> {
  try {
    const response = await fetch(apiUrl("/auth/oauth/validate-token"), {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Token validation failed");
    }

    return data;
  } catch (err: any) {
    throw new Error(err.message || "Failed to validate token");
  }
}
