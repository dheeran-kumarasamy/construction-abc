import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

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
      const res = await fetch("http://localhost:3001/auth/accept-invite", {
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
    <div style={styles.wrapper}>
      <form style={styles.card} onSubmit={handleAccept}>
        <h2>Accept Invite</h2>

        <input
          type="password"
          placeholder="Set password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={styles.input}
        />

        {error && <div style={styles.error}>{error}</div>}

        <button disabled={loading} style={styles.button}>
          {loading ? "Creating account..." : "Accept & Continue"}
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#F8F9FB",
  },
  card: {
    background: "#FFF",
    padding: 32,
    borderRadius: 16,
    width: 360,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  input: {
    padding: 12,
    borderRadius: 8,
    border: "1px solid #ddd",
  },
  button: {
    padding: 12,
    borderRadius: 8,
    border: "none",
    background: "#111827",
    color: "white",
  },
  error: { color: "red", fontSize: 12 },
};