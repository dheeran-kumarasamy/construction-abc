import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { Role } from "../auth/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("architect");

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim()) return;

    login(email, role);

    // Navigate based on role
    if (role === "architect") navigate("/architect");
    else if (role === "builder") navigate("/builder");
    else navigate("/client");
  }

  return (
    <div style={styles.page}>
      <form onSubmit={handleLogin} style={styles.card}>
        <h2>Login</h2>

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
        />

        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          style={styles.input}
        >
          <option value="architect">Architect</option>
          <option value="builder">Builder</option>
          <option value="client">Client</option>
        </select>

        <button type="submit" style={styles.btn}>
          Login
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#F8F9FB",
  },
  card: {
    background: "white",
    padding: 32,
    borderRadius: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    width: 320,
  },
  input: {
    padding: 10,
    borderRadius: 8,
    border: "1px solid #D1D5DB",
  },
  btn: {
    background: "#3B5BDB",
    color: "white",
    border: "none",
    padding: 10,
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 600,
  },
};
