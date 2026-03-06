import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { pageStyles } from "../layouts/pageStyles";
import { apiUrl } from "../services/api";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

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

  return (
    <div style={pageStyles.page}>
      <form
        style={{ ...pageStyles.card, width: "min(380px, 100%)" }}
        onSubmit={mode === "login" ? handleLogin : handleRegister}
      >
        <h2 style={pageStyles.title}>{mode === "login" ? "Login" : "Register"}</h2>

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
            }}
          >
            Register
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
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        {error && <div style={pageStyles.error}>{error}</div>}

        <button
          style={pageStyles.primaryBtn}
          disabled={loading}
        >
          {loading ? (mode === "login" ? "Signing in..." : "Creating account...") : mode === "login" ? "Sign In" : "Create Account"}
        </button>
      </form>
    </div>
  );
}
