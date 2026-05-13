import { GoogleLogin } from "@react-oauth/google";
import type { CredentialResponse } from "@react-oauth/google";
import { handleGoogleOAuthCallback } from "../services/googleOAuth";
import type { GoogleOAuthResult } from "../services/googleOAuth";

interface GoogleLoginButtonProps {
  role: "architect" | "builder" | "dealer";
  onSuccess: (result: GoogleOAuthResult) => Promise<void>;
  onError: (error: string) => void;
}

export default function GoogleLoginButton({ role, onSuccess, onError }: GoogleLoginButtonProps) {
  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    try {
      if (!credentialResponse.credential) {
        onError("No credential received from Google");
        return;
      }

      const result = await handleGoogleOAuthCallback(credentialResponse.credential, role);
      await onSuccess(result);
    } catch (err: any) {
      onError(err.message || "Failed to authenticate with Google");
    }
  };

  return (
    <div style={{ marginBottom: "12px" }}>
      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={() => onError("Failed to authenticate with Google")}
        size="large"
        width="100%"
        text="signin_with"
        theme="outline"
      />
    </div>
  );
}
