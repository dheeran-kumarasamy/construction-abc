import { useEffect, useState } from "react";
import type { Material, District } from "./types";

interface Props {
  open: boolean;
  materials: Material[];
  district: District | null;
  onClose: () => void;
  onSave: (payload: { materialId: string; districtId: string; condition: "above" | "below"; threshold: number }) => Promise<void>;
}

export default function AlertDialog({ open, materials, district, onClose, onSave }: Props) {
  const [materialId, setMaterialId] = useState<string>("");
  const [condition, setCondition] = useState<"above" | "below">("above");
  const [threshold, setThreshold] = useState<string>("");

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !district) return null;

  const submit = async () => {
    if (!materialId || !threshold) return;

    await onSave({
      materialId,
      districtId: district.id,
      condition,
      threshold: Number(threshold),
    });

    setMaterialId("");
    setThreshold("");
    onClose();
  };

  return (
    <div className="pt-modal-backdrop" onClick={onClose}>
      <div className="pt-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Create Price Alert</h3>
          <button
            type="button"
            aria-label="Close alert dialog"
            onClick={onClose}
            style={{
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 999,
              width: 32,
              height: 32,
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <p>{district.name}</p>

        <label>Material</label>
        <select value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
          <option value="">Select material</option>
          {materials.map((material) => (
            <option key={material.id} value={material.id}>
              {material.name}
            </option>
          ))}
        </select>

        <label>Condition</label>
        <select value={condition} onChange={(e) => setCondition(e.target.value as "above" | "below")}>
          <option value="above">Above</option>
          <option value="below">Below</option>
        </select>

        <label>Threshold (₹)</label>
        <input
          type="number"
          min="0"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          placeholder="e.g. 400"
        />

        <div className="pt-modal-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" onClick={submit}>Save Alert</button>
        </div>
      </div>
    </div>
  );
}
