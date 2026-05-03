import { useEffect, useState } from "react";
import { apiUrl } from "../../services/api";
import { pageStyles } from "../../layouts/pageStyles";
import { formatINR } from "../../services/currency";

interface ComparisonRow {
  builder_org_id: string;
  revision_id: string;
  revision_number: number;
  margin_percent: number;
  grand_total: number;
  rank: number;
  awarded_revision_id?: string | null;
}

export default function ComparisonScreen({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ComparisonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [awarding, setAwarding] = useState<string | null>(null);
  const token = localStorage.getItem("token") || "";

  useEffect(() => {
    async function fetchComparison() {
      try {
        const res = await fetch(
          apiUrl(`/projects/${projectId}/comparison`),
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Failed to load comparison", err);
      } finally {
        setLoading(false);
      }
    }

    fetchComparison();
  }, [projectId, token]);

  async function handleAward(revisionId: string) {
    const awardedRevisionId = data.find((row) => row.awarded_revision_id)?.awarded_revision_id || null;
    const isChangingAward = Boolean(awardedRevisionId && awardedRevisionId !== revisionId);
    const confirmationMessage = isChangingAward
      ? "This project is already awarded to another builder. Are you sure you want to change the award to this builder?"
      : "Are you sure you want to award this builder?";

    if (!confirm(confirmationMessage)) return;

    try {
      setAwarding(revisionId);

      const res = await fetch(
        apiUrl(`/projects/${projectId}/award`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ estimateRevisionId: revisionId }),
        }
      );

      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Award failed");

      alert(json.replaced ? "Award updated successfully" : "Project awarded successfully");
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAwarding(null);
    }
  }

  const awardedRevisionId = data.find((row) => row.awarded_revision_id)?.awarded_revision_id || null;
  const awardedRow = awardedRevisionId
    ? data.find((row) => row.revision_id === awardedRevisionId) || null
    : null;

  if (loading) {
    return (
      <div className="architect-theme architect-page" style={pageStyles.page}>
        <p style={{ color: "var(--muted)", fontSize: "18px" }}>Loading comparison…</p>
      </div>
    );
  }

  return (
    <div className="architect-theme architect-page" style={pageStyles.page}>
      <div className="architect-surface" style={pageStyles.card}>
        <h2 style={pageStyles.title}>Builder Comparison</h2>

        {awardedRow ? (
          <div
            style={{
              marginBottom: "0.9rem",
              padding: "0.85rem 1rem",
              borderRadius: "10px",
              border: "1px solid #99f6e4",
              background: "#f0fdfa",
              color: "#115e59",
              fontWeight: 600,
            }}
          >
            Currently awarded builder: {awardedRow.builder_org_id}
          </div>
        ) : null}

        <div style={{ overflowX: "auto" }}>
          <table style={pageStyles.table}>
            <thead>
              <tr>
                <th style={pageStyles.th}>Rank</th>
                <th style={pageStyles.th}>Builder</th>
                <th style={pageStyles.th}>Revision</th>
                <th style={pageStyles.th}>Margin %</th>
                <th style={pageStyles.th}>Grand Total</th>
                <th style={pageStyles.th}>Action</th>
              </tr>
            </thead>

            <tbody>
              {data.map((row, idx) => {
                const isLowest = row.rank === 1;

                return (
                  <tr
                    key={row.revision_id}
                    style={{
                      ...(idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd),
                      ...(isLowest ? { backgroundColor: "#f0fdfa" } : {}),
                    }}
                  >
                    <td style={{ ...pageStyles.td, fontWeight: 600 }}>#{row.rank}</td>
                    <td style={pageStyles.td}>{row.builder_org_id}</td>
                    <td style={pageStyles.td}>Rev {row.revision_number}</td>
                    <td style={pageStyles.td}>{row.margin_percent}%</td>
                    <td style={{ ...pageStyles.td, fontWeight: 500 }}>
                      {formatINR(row.grand_total, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                    <td style={pageStyles.td}>
                      <button
                        disabled={awarding !== null || row.revision_id === awardedRevisionId}
                        onClick={() => handleAward(row.revision_id)}
                        style={{
                          ...(isLowest ? pageStyles.primaryBtn : pageStyles.secondaryBtn),
                          height: "36px",
                          fontSize: "13px",
                          ...(row.revision_id === awardedRevisionId ? { opacity: 0.55, cursor: "not-allowed" } : {}),
                        }}
                      >
                        {row.revision_id === awardedRevisionId
                          ? "Awarded"
                          : awarding === row.revision_id
                          ? "Awarding…"
                          : "Award"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}