import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";

export default function AcceptInvite() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to accept invite");

      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);

      if (data.role === "architect") navigate("/architect");
      else if (data.role === "builder") navigate("/builder");
      else navigate("/client");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageStyles.page}>
      <form
        style={{ ...pageStyles.card, width: "min(380px, 100%)" }}
        onSubmit={handleAccept}
      >
        <h2 style={pageStyles.title}>Accept Invite</h2>

        <input
          type="password"
          placeholder="Set password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={pageStyles.input}
        />

        {error && <div style={pageStyles.error}>{error}</div>}

        <button disabled={loading} style={pageStyles.primaryBtn}>
          {loading ? "Creating account..." : "Accept & Continue"}
        </button>
      </form>
    </div>
  );
}