import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();

  const roles = [
    { id: "architect", label: "Architect" },
    { id: "builder", label: "Builder" },
    { id: "client", label: "Client" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F8F9FB",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "24px",
          width: "720px",
        }}
      >
        {roles.map((r) => (
          <button
            key={r.id}
            onClick={() => navigate(`/${r.id}`)}
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "40px",
              fontSize: "20px",
              fontWeight: 600,
              border: "1px solid #E5E7EB",
              cursor: "pointer",
            }}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}