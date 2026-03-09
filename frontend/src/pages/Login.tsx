import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { pageStyles } from "../layouts/pageStyles";
import { apiUrl } from "../services/api";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const normalizedEmail = email.trim().toLowerCase();

      const res = await fetch(apiUrl("/auth/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Store session in context AND localStorage
      login(normalizedEmail, data.role, data.orgRole || null);
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);

      // Redirect by role
      if (data.role === "architect") navigate("/architect");
      else if (data.role === "builder") navigate("/builder");
      else if (data.role === "client") navigate("/client");
      else navigate("/");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const normalizedEmail = email.trim().toLowerCase();

      const payload: Record<string, string> = {
        email: normalizedEmail,
        password,
        role: "architect",
      };

      payload.organizationName = organizationName.trim();

      const res = await fetch(apiUrl("/auth/register"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }

      login(normalizedEmail, data.role, data.orgRole || null);
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);

      if (data.role === "architect") navigate("/architect");
      else if (data.role === "builder") navigate("/builder");
      else navigate("/");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const normalizedEmail = email.trim().toLowerCase();

      const res = await fetch(apiUrl("/auth/reset-password"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail, newPassword: password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Password reset failed");
      }

      setSuccessMessage("Password reset successful. Please login with your new password.");
      setMode("login");
      setPassword("");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageStyles.page}>
      <form
        style={{ ...pageStyles.card, width: "min(380px, 100%)" }}
        onSubmit={mode === "login" ? handleLogin : mode === "register" ? handleRegister : handleResetPassword}
      >
        <h2 style={pageStyles.title}>{mode === "login" ? "Login" : mode === "register" ? "Register" : "Reset Password"}</h2>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            style={mode === "login" ? pageStyles.primaryBtn : pageStyles.secondaryBtn}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            Login
          </button>
          <button
            type="button"
            style={mode === "register" ? pageStyles.primaryBtn : pageStyles.secondaryBtn}
            onClick={() => {
              setMode("register");
              setError("");
              setSuccessMessage("");
            }}
          >
            Register
          </button>
          <button
            type="button"
            style={mode === "reset" ? pageStyles.primaryBtn : pageStyles.secondaryBtn}
            onClick={() => {
              setMode("reset");
              setError("");
              setSuccessMessage("");
            }}
          >
            Reset Password
          </button>
        </div>

        <input
          style={pageStyles.input}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
        />

        {mode === "register" && (
          <input
            style={pageStyles.input}
            type="text"
            placeholder="Organization Name"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            required
          />
        )}

        <input
          style={pageStyles.input}
          type="password"
          placeholder={mode === "reset" ? "New Password" : "Password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        {error && <div style={pageStyles.error}>{error}</div>}
        {successMessage && <div style={{ color: "#0f766e", fontWeight: 600 }}>{successMessage}</div>}

        <button
          style={pageStyles.primaryBtn}
          disabled={loading}
        >
          {loading
            ? mode === "login"
              ? "Signing in..."
              : mode === "register"
              ? "Creating account..."
              : "Resetting password..."
            : mode === "login"
            ? "Sign In"
            : mode === "register"
            ? "Create Account"
            : "Reset Password"}
        </button>
      </form>
    </div>
  );
}
