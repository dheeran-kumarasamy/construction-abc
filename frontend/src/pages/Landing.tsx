import { useNavigate } from "react-router-dom";
import { pageStyles } from "../layouts/pageStyles";

export default function Landing() {
  const navigate = useNavigate();

  const roles = [
    { id: "architect", label: "Architect" },
    { id: "builder", label: "Builder" },
    { id: "client", label: "Client" },
  ];

  return (
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(760px, 100%)" }}>
        <div style={pageStyles.header}>
          <div>
            <h2 style={pageStyles.title}>Choose a Role</h2>
            <p style={pageStyles.subtitle}>
              Continue as architect, builder, or client.
            </p>
          </div>
        </div>
        <div style={pageStyles.grid}>
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate(`/${r.id}`)}
              style={pageStyles.tileBtn}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}