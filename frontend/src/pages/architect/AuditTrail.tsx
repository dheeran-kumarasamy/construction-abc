import { useEffect, useState } from "react";

interface AuditEntry {
  action: string;
  user: string;
  timestamp: string;
}

const STORAGE_KEY = "audit_trail";

export function logAudit(action: string, user: string) {
  const entry: AuditEntry = {
    action,
    user,
    timestamp: new Date().toISOString(),
  };

  const existing: AuditEntry[] = localStorage.getItem(STORAGE_KEY)
    ? JSON.parse(localStorage.getItem(STORAGE_KEY) as string)
    : [];

  existing.push(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export default function AuditTrail() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setEntries(JSON.parse(stored));
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2>Audit Trail</h2>

        {entries.length === 0 ? (
          <p>No audit records yet.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Action</th>
                <th>User</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, idx) => (
                <tr key={idx}>
                  <td>{e.action}</td>
                  <td>{e.user}</td>
                  <td>{new Date(e.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
    width: "900px",
    border: "1px solid #E5E7EB",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
};
