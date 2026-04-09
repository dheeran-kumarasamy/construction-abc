import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { pageStyles } from "../layouts/pageStyles";
import { apiUrl } from "../services/api";
import FingerInAirEstimator from "../components/FingerInAirEstimator";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [registerRole, setRegisterRole] = useState<"architect" | "dealer" | "builder">("architect");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [architectPhoneNumber, setArchitectPhoneNumber] = useState("");
  const [shopName, setShopName] = useState("");
  const [city, setCity] = useState("");
  const [dealerCategoryIds, setDealerCategoryIds] = useState<string[]>([]);
  const [dealerCategories, setDealerCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [builderCompanyName, setBuilderCompanyName] = useState("");
  const [builderPhone, setBuilderPhone] = useState("");
  const [builderLocations, setBuilderLocations] = useState("");
  const [builderSpecialties, setBuilderSpecialties] = useState("");
  const [quickEstimateOpen, setQuickEstimateOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (mode !== "register" || registerRole !== "dealer") return;

    fetch(apiUrl("/api/prices/categories"))
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch categories");
        return res.json();
      })
      .then((rows) => {
        const options = Array.isArray(rows)
          ? rows
              .map((row: any) => ({
                id: String(row?.id || ""),
                name: String(row?.name || ""),
              }))
              .filter((row) => row.id && row.name)
          : [];

        setDealerCategories(options);
        setDealerCategoryIds((prev) => prev.filter((id) => options.some((opt) => opt.id === id)));
      })
      .catch(() => {
        setDealerCategories([]);
        setDealerCategoryIds([]);
      });
  }, [mode, registerRole]);

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
      login(normalizedEmail, data.role, data.orgRole || null, data.adminRole || null);
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      if (data.role === "builder") {
        localStorage.setItem("builder_profile_complete", data.profileComplete ? "1" : "0");
      }

      // Redirect by role
      if (data.role === "architect") navigate("/architect");
      else if (data.role === "builder") {
        if (data.profileComplete) navigate("/builder");
        else navigate("/builder/profile/setup");
      }
      else if (data.role === "client") navigate("/client");
      else if (data.role === "dealer") navigate("/prices");
      else if (data.role === "admin") navigate("/admin");
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

      const payload: Record<string, any> = {
        email: normalizedEmail,
        password,
        role: registerRole,
      };

      if (registerRole === "architect") {
        payload.organizationName = organizationName.trim();
        payload.phoneNumber = architectPhoneNumber.trim() || undefined;
      } else if (registerRole === "builder") {
        payload.builderData = {
          companyName: builderCompanyName.trim(),
          contactPhone: builderPhone.trim() || undefined,
          serviceLocations: builderLocations.trim() || undefined,
          specialties: builderSpecialties.trim() || undefined,
        };
      } else {
        if (dealerCategoryIds.length === 0) {
          throw new Error("Please select at least one product category.");
        }
        payload.dealerData = {
          shopName: shopName.trim(),
          city: city.trim() || undefined,
          productCategoryIds: dealerCategoryIds,
        };
      }

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
      if (data.role === "builder") {
        localStorage.setItem("builder_profile_complete", data.profileComplete ? "1" : "0");
      }

      if (data.role === "architect") navigate("/architect");
      else if (data.role === "builder") {
        if (data.profileComplete) navigate("/builder");
        else navigate("/builder/profile/setup");
      }
      else if (data.role === "dealer") navigate("/prices");
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

        <div style={{ ...pageStyles.card, background: "#f8fafc", border: "1px solid #cbd5e1", padding: "10px 12px", marginBottom: 6 }}>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#334155", fontWeight: 600 }}>
            Try tools before login
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              style={pageStyles.secondaryBtn}
              onClick={() => setQuickEstimateOpen(true)}
            >
              Quick Estimate
            </button>
            <button
              type="button"
              style={pageStyles.secondaryBtn}
              onClick={() => navigate("/market-prices")}
            >
              Material Prices
            </button>
          </div>
        </div>

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
          <>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                style={registerRole === "architect" ? pageStyles.primaryBtn : pageStyles.secondaryBtn}
                onClick={() => setRegisterRole("architect")}
              >
                Architect
              </button>
              <button
                type="button"
                style={registerRole === "builder" ? pageStyles.primaryBtn : pageStyles.secondaryBtn}
                onClick={() => setRegisterRole("builder")}
              >
                Builder
              </button>
              <button
                type="button"
                style={registerRole === "dealer" ? pageStyles.primaryBtn : pageStyles.secondaryBtn}
                onClick={() => setRegisterRole("dealer")}
              >
                Dealer
              </button>
            </div>

            {registerRole === "architect" ? (
              <>
                <input
                  style={pageStyles.input}
                  type="text"
                  placeholder="Organization Name"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  required
                />
                <input
                  style={pageStyles.input}
                  type="tel"
                  placeholder="Head Phone Number for SMS (optional)"
                  value={architectPhoneNumber}
                  onChange={(e) => setArchitectPhoneNumber(e.target.value)}
                />
              </>
            ) : registerRole === "builder" ? (
              <>
                <input
                  style={pageStyles.input}
                  type="text"
                  placeholder="Company / Firm Name"
                  value={builderCompanyName}
                  onChange={(e) => setBuilderCompanyName(e.target.value)}
                  required
                />
                <input
                  style={pageStyles.input}
                  type="tel"
                  placeholder="Contact Phone"
                  value={builderPhone}
                  onChange={(e) => setBuilderPhone(e.target.value)}
                  required
                />
                <input
                  style={pageStyles.input}
                  type="text"
                  placeholder="Service Locations (e.g. Mumbai, Pune)"
                  value={builderLocations}
                  onChange={(e) => setBuilderLocations(e.target.value)}
                  required
                />
                <input
                  style={pageStyles.input}
                  type="text"
                  placeholder="Specialties (e.g. Residential, Interiors)"
                  value={builderSpecialties}
                  onChange={(e) => setBuilderSpecialties(e.target.value)}
                  required
                />
              </>
            ) : (
              <>
                <input
                  style={pageStyles.input}
                  type="text"
                  placeholder="Shop Name"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  required
                />
                <input
                  style={pageStyles.input}
                  type="text"
                  placeholder="City (optional)"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
                <div
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: "10px 12px",
                    background: "#f8fafc",
                  }}
                >
                  <div style={{ color: "#0f172a", fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                    Products Dealt In
                  </div>
                  {dealerCategories.length === 0 ? (
                    <div style={{ color: "#64748b", fontSize: 13 }}>No categories available</div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {dealerCategories.map((category) => {
                        const checked = dealerCategoryIds.includes(category.id);
                        return (
                          <label
                            key={category.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              color: "#0f172a",
                              fontSize: 14,
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setDealerCategoryIds((prev) => [...prev, category.id]);
                                } else {
                                  setDealerCategoryIds((prev) => prev.filter((id) => id !== category.id));
                                }
                              }}
                            />
                            <span>{category.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div style={{ color: "#475569", fontSize: 12, marginTop: -4, marginBottom: 6 }}>
                  Select at least one category.
                </div>
              </>
            )}
          </>
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

      {quickEstimateOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2, 6, 23, 0.6)",
            zIndex: 1300,
            display: "grid",
            placeItems: "center",
            padding: "16px",
          }}
          onClick={() => setQuickEstimateOpen(false)}
        >
          <div
            style={{
              width: "min(980px, 100%)",
              maxHeight: "92vh",
              overflow: "auto",
              background: "#ffffff",
              borderRadius: "14px",
              border: "1px solid #cbd5e1",
              padding: "14px",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, color: "#0f172a" }}>Quick Estimate</h3>
              <button
                type="button"
                aria-label="Close quick estimate"
                style={{
                  ...pageStyles.secondaryBtn,
                  minWidth: 36,
                  width: 36,
                  height: 36,
                  padding: 0,
                  borderRadius: 999,
                  fontSize: 18,
                  lineHeight: 1,
                }}
                onClick={() => setQuickEstimateOpen(false)}
              >
                x
              </button>
            </div>
            <FingerInAirEstimator />
          </div>
        </div>
      ) : null}
    </div>
  );
}
