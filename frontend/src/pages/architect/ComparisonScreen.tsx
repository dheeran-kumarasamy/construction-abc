import { useEffect, useState } from "react";

interface ComparisonRow {
  builder_org_id: string;
  revision_id: string;
  revision_number: number;
  margin_percent: number;
  grand_total: number;
  rank: number;
}

export default function ComparisonScreen({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ComparisonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [awarding, setAwarding] = useState<string | null>(null);

  useEffect(() => {
    async function fetchComparison() {
      try {
        const res = await fetch(
          `http://localhost:4000/projects/${projectId}/comparison`
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
  }, [projectId]);

  async function handleAward(revisionId: string) {
    if (!confirm("Are you sure you want to award this builder?")) return;

    try {
      setAwarding(revisionId);

      const res = await fetch(
        `http://localhost:4000/projects/${projectId}/award`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estimateRevisionId: revisionId }),
        }
      );

      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Award failed");

      alert("Project awarded successfully");
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAwarding(null);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-gray-600 text-lg">Loading comparison…</div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-6">Builder Comparison</h1>

      <div className="bg-white rounded-2xl shadow border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4">Rank</th>
              <th className="p-4">Builder</th>
              <th className="p-4">Revision</th>
              <th className="p-4">Margin %</th>
              <th className="p-4">Grand Total</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>

          <tbody>
            {data.map((row) => {
              const isLowest = row.rank === 1;

              return (
                <tr
                  key={row.revision_id}
                  className={`border-b last:border-0 ${
                    isLowest ? "bg-green-50" : ""
                  }`}
                >
                  <td className="p-4 font-semibold">#{row.rank}</td>
                  <td className="p-4">{row.builder_org_id}</td>
                  <td className="p-4">Rev {row.revision_number}</td>
                  <td className="p-4">{row.margin_percent}%</td>
                  <td className="p-4 font-medium">
                    ₹ {row.grand_total.toLocaleString()}
                  </td>
                  <td className="p-4">
                    <button
                      disabled={awarding !== null}
                      onClick={() => handleAward(row.revision_id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        isLowest
                          ? "bg-green-600 text-white hover:bg-green-700"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      {awarding === row.revision_id
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
  );
}