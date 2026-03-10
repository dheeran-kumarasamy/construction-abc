import type { CompareResponse } from "./types";

interface Props {
  data: CompareResponse | null;
}

export default function CompareTable({ data }: Props) {
  if (!data) return null;

  const districtKeys = Object.keys(data.districts);
  if (districtKeys.length < 2) return null;

  return (
    <div className="pt-card">
      <h3>District Compare</h3>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>Unit</th>
              {districtKeys.map((district) => (
                <th key={district}>{district}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.materials.map((material) => {
              const values = districtKeys
                .map((district) => data.districts[district][material.materialId])
                .filter((value): value is number => value != null);

              const min = values.length ? Math.min(...values) : null;
              const max = values.length ? Math.max(...values) : null;

              return (
                <tr key={material.materialId}>
                  <td>{material.materialName}</td>
                  <td>{material.unit}</td>
                  {districtKeys.map((district) => {
                    const value = data.districts[district][material.materialId];
                    const style: { background?: string } = {};

                    if (value != null && min != null && max != null) {
                      if (value === min) style.background = "#dcfce7";
                      if (value === max) style.background = "#fee2e2";
                    }

                    return (
                      <td key={`${material.materialId}-${district}`} style={style}>
                        {value != null ? `₹${value.toFixed(2)}` : "-"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
