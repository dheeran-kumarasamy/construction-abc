import { useState } from "react";

interface Invite {
  email: string;
  status: "pending" | "accepted";
}

export default function InviteBuilders() {
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState<Invite[]>([]);

  function sendInvite() {
    if (!email.trim()) return;

    const newInvite: Invite = { email, status: "pending" };

    setInvites((prev) => [...prev, newInvite]);
    setEmail("");
  }

  function acceptInvite(index: number) {
    setInvites((prev) =>
      prev.map((inv, i) =>
        i === index ? { ...inv, status: "accepted" } : inv
      )
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2>Invite Builders to Project</h2>

        <div style={styles.row}>
          <input
            placeholder="Builder email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
          />

          <button onClick={sendInvite} style={styles.primaryBtn}>
            Send Invite
          </button>
        </div>

        <table style={styles.table}>
          <thead>
            <tr>
              <th>Email</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {invites.map((inv, idx) => (
              <tr key={idx}>
                <td>{inv.email}</td>
                <td>{inv.status}</td>
                <td>
                  {inv.status === "pending" && (
                    <button
                      onClick={() => acceptInvite(idx)}
                      style={styles.secondaryBtn}
                    >
                      Mark Accepted
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F8F9FB",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Inter, sans-serif",
  },
  card: {
    background: "#FFFFFF",
    padding: "32px",
    borderRadius: "16px",
    width: "720px",
    border: "1px solid #E5E7EB",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  row: {
    display: "flex",
    gap: "8px",
  },
  input: {
    flex: 1,
    padding: "8px",
    borderRadius: "8px",
    border: "1px solid #D1D5DB",
  },
  primaryBtn: {
    background: "#3B5BDB",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: "8px",
    cursor: "pointer",
  },
  secondaryBtn: {
    background: "white",
    border: "1px solid #D1D5DB",
    padding: "6px 10px",
    borderRadius: "6px",
    cursor: "pointer",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
};
