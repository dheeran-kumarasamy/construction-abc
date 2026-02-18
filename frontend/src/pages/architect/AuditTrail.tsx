import { useEffect, useState } from "react";
import { pageStyles } from "../../layouts/pageStyles";

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
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, width: "min(980px, 100%)" }}>
        <h2 style={pageStyles.title}>Audit Trail</h2>

        {entries.length === 0 ? (
          <p>No audit records yet.</p>
        ) : (
          <table style={pageStyles.table}>
            <thead>
              <tr>
                <th style={pageStyles.th}>Action</th>
                <th style={pageStyles.th}>User</th>
                <th style={pageStyles.th}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, idx) => (
                <tr key={idx} style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                  <td style={pageStyles.td}>{e.action}</td>
                  <td style={pageStyles.td}>{e.user}</td>
                  <td style={pageStyles.td}>{new Date(e.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// remove local styles object
