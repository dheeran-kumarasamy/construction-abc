import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { Role } from "../auth/AuthContext";
import { pageStyles } from "../layouts/pageStyles";

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
    <div style={pageStyles.page}>
      <form onSubmit={handleLogin} style={{ ...pageStyles.card, width: "min(360px, 100%)" }}>
        <h2 style={pageStyles.title}>Login</h2>

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={pageStyles.input}
        />

        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          style={pageStyles.select}
        >
          <option value="architect">Architect</option>
          <option value="builder">Builder</option>
          <option value="client">Client</option>
        </select>

        <button type="submit" style={pageStyles.primaryBtn}>
          Login
        </button>
      </form>
    </div>
  );
}
