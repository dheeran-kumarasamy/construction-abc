import { useEffect, useMemo, useState } from "react";
import { pageStyles } from "../../layouts/pageStyles";

interface AdditionalDetails {
  excavationVolume: string;
  backfillingVolume: string;
  antiTermiteTreatment: string;
  solingPcc: string;
  concreteVolume: string;
  reinforcementWeight: string;
  formworkArea: string;
  wallAreaVolume: string;
  doorCountDetails: string;
  windowCountDetails: string;
  lintelsSills: string;
  plasteringArea: string;
  flooringArea: string;
  skirtingLength: string;
  paintingArea: string;
  ceilingArea: string;
  plumbingPoints: string;
  pipeLengths: string;
  electricalPoints: string;
  wiringConduitLength: string;
  switchgear: string;
  waterproofingArea: string;
  railingLength: string;
  sitePreliminaries: string;
}

interface RequirementRecord {
  id: string;
  projectName: string;
  windowsCount: number;
  doorsCount: number;
  floorCount: number;
  additionalDetails: AdditionalDetails;
  planFileName: string;
  createdAt: string;
}

const STORAGE_KEY = "architect_plan_requirements_records";

const EMPTY_ADDITIONAL_DETAILS: AdditionalDetails = {
  excavationVolume: "",
  backfillingVolume: "",
  antiTermiteTreatment: "",
  solingPcc: "",
  concreteVolume: "",
  reinforcementWeight: "",
  formworkArea: "",
  wallAreaVolume: "",
  doorCountDetails: "",
  windowCountDetails: "",
  lintelsSills: "",
  plasteringArea: "",
  flooringArea: "",
  skirtingLength: "",
  paintingArea: "",
  ceilingArea: "",
  plumbingPoints: "",
  pipeLengths: "",
  electricalPoints: "",
  wiringConduitLength: "",
  switchgear: "",
  waterproofingArea: "",
  railingLength: "",
  sitePreliminaries: "",
};

const DETAIL_SECTIONS: Array<{
  title: string;
  fields: Array<{ key: keyof AdditionalDetails; label: string; placeholder: string }>;
}> = [
  {
    title: "1. Earthwork & Foundation",
    fields: [
      { key: "excavationVolume", label: "Excavation volume", placeholder: "Total cubic area to be dug for footings and trenches" },
      { key: "backfillingVolume", label: "Backfilling volume", placeholder: "Amount of soil needed to fill around foundations" },
      { key: "antiTermiteTreatment", label: "Anti-termite treatment", placeholder: "Total square area of the ground floor/foundation" },
      { key: "solingPcc", label: "Soling / PCC", placeholder: "Thickness and area of the lean concrete base" },
    ],
  },
  {
    title: "2. Concrete & Steel (RCC)",
    fields: [
      { key: "concreteVolume", label: "Concrete volume", placeholder: "Total cubic meters for footings, columns, beams, and slabs" },
      { key: "reinforcementWeight", label: "Reinforcement weight", placeholder: "Total tonnage of steel bars broken down by diameter" },
      { key: "formworkArea", label: "Formwork area", placeholder: "Total surface area of shuttering/centering required for casting" },
    ],
  },
  {
    title: "3. Masonry & Openings",
    fields: [
      { key: "wallAreaVolume", label: "Wall area / volume", placeholder: "Total bricks or blocks required after subtracting openings" },
      { key: "doorCountDetails", label: "Door count", placeholder: "Units categorized by size and frame material" },
      { key: "windowCountDetails", label: "Window count", placeholder: "Units categorized by type and glass specification" },
      { key: "lintelsSills", label: "Lintels & sills", placeholder: "Linear length of concrete supports above and below openings" },
    ],
  },
  {
    title: "4. Finishes",
    fields: [
      { key: "plasteringArea", label: "Plastering area", placeholder: "Total internal and external wall surfaces in sqm" },
      { key: "flooringArea", label: "Flooring area", placeholder: "Total square area for each room type" },
      { key: "skirtingLength", label: "Skirting length", placeholder: "Linear measurement of the border around floor edges" },
      { key: "paintingArea", label: "Painting area", placeholder: "Total surface area for primer, putty, and final coats" },
      { key: "ceilingArea", label: "Ceiling area", placeholder: "Total area for plastering or false ceiling installation" },
    ],
  },
  {
    title: "5. MEP (Mechanical, Electrical, Plumbing)",
    fields: [
      { key: "plumbingPoints", label: "Plumbing points", placeholder: "Number of taps, showers, toilets, and floor drains" },
      { key: "pipeLengths", label: "Pipe lengths", placeholder: "Running length of supply and drainage pipes by diameter" },
      { key: "electricalPoints", label: "Electrical points", placeholder: "Count of light points, fan points, and power sockets" },
      { key: "wiringConduitLength", label: "Wiring / conduit length", placeholder: "Total linear length of wires and PVC pipes" },
      { key: "switchgear", label: "Switchgear", placeholder: "Number of DBs and circuit breakers" },
    ],
  },
  {
    title: "6. External & Miscellaneous",
    fields: [
      { key: "waterproofingArea", label: "Waterproofing area", placeholder: "Area for toilets, balconies, and terrace" },
      { key: "railingLength", label: "Railing length", placeholder: "Linear length for stairs and balconies" },
      { key: "sitePreliminaries", label: "Site preliminaries", placeholder: "Months for site office rental, water, and electricity" },
    ],
  },
];

function normalizeAdditionalDetails(value: unknown): AdditionalDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_ADDITIONAL_DETAILS };
  }

  const details = value as Record<string, unknown>;
  return {
    excavationVolume: String(details.excavationVolume || ""),
    backfillingVolume: String(details.backfillingVolume || ""),
    antiTermiteTreatment: String(details.antiTermiteTreatment || ""),
    solingPcc: String(details.solingPcc || ""),
    concreteVolume: String(details.concreteVolume || ""),
    reinforcementWeight: String(details.reinforcementWeight || ""),
    formworkArea: String(details.formworkArea || ""),
    wallAreaVolume: String(details.wallAreaVolume || ""),
    doorCountDetails: String(details.doorCountDetails || ""),
    windowCountDetails: String(details.windowCountDetails || ""),
    lintelsSills: String(details.lintelsSills || ""),
    plasteringArea: String(details.plasteringArea || ""),
    flooringArea: String(details.flooringArea || ""),
    skirtingLength: String(details.skirtingLength || ""),
    paintingArea: String(details.paintingArea || ""),
    ceilingArea: String(details.ceilingArea || ""),
    plumbingPoints: String(details.plumbingPoints || ""),
    pipeLengths: String(details.pipeLengths || ""),
    electricalPoints: String(details.electricalPoints || ""),
    wiringConduitLength: String(details.wiringConduitLength || ""),
    switchgear: String(details.switchgear || ""),
    waterproofingArea: String(details.waterproofingArea || ""),
    railingLength: String(details.railingLength || ""),
    sitePreliminaries: String(details.sitePreliminaries || ""),
  };
}

function summarizeAdditionalDetails(details: AdditionalDetails) {
  const filled = DETAIL_SECTIONS.flatMap((section) =>
    section.fields
      .filter((field) => String(details[field.key] || "").trim())
      .map((field) => `${field.label}: ${String(details[field.key]).trim()}`)
  );

  if (filled.length === 0) {
    return "-";
  }

  return `${filled.slice(0, 3).join(" | ")}${filled.length > 3 ? ` | +${filled.length - 3} more` : ""}`;
}

function loadRecords(): RequirementRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((record: any) => ({
      id: String(record?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
      projectName: String(record?.projectName || ""),
      windowsCount: Number(record?.windowsCount || 0),
      doorsCount: Number(record?.doorsCount || 0),
      floorCount: Number(record?.floorCount || 1),
      additionalDetails: normalizeAdditionalDetails(record?.additionalDetails),
      planFileName: String(record?.planFileName || ""),
      createdAt: String(record?.createdAt || new Date().toISOString()),
    }));
  } catch {
    return [];
  }
}

function saveRecords(records: RequirementRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export default function PlanRequirementsModule() {
  const [projectName, setProjectName] = useState("");
  const [windowsCount, setWindowsCount] = useState(0);
  const [doorsCount, setDoorsCount] = useState(0);
  const [floorCount, setFloorCount] = useState(1);
  const [additionalDetails, setAdditionalDetails] = useState<AdditionalDetails>({ ...EMPTY_ADDITIONAL_DETAILS });
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [records, setRecords] = useState<RequirementRecord[]>(() => loadRecords());
  const [selectedRecord, setSelectedRecord] = useState<RequirementRecord | null>(null);

  const canSave = useMemo(() => {
    return projectName.trim().length > 0 && !!planFile;
  }, [projectName, planFile]);

  function handleSave() {
    if (!canSave || !planFile) return;

    const next: RequirementRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      projectName: projectName.trim(),
      windowsCount: Number.isFinite(windowsCount) ? windowsCount : 0,
      doorsCount: Number.isFinite(doorsCount) ? doorsCount : 0,
      floorCount: Number.isFinite(floorCount) ? floorCount : 1,
      additionalDetails: { ...additionalDetails },
      planFileName: planFile.name,
      createdAt: new Date().toISOString(),
    };

    const updated = [next, ...records];
    setRecords(updated);
    saveRecords(updated);

    setProjectName("");
    setWindowsCount(0);
    setDoorsCount(0);
    setFloorCount(1);
    setAdditionalDetails({ ...EMPTY_ADDITIONAL_DETAILS });
    setPlanFile(null);
  }

  function handleClearHistory() {
    setRecords([]);
    localStorage.removeItem(STORAGE_KEY);
    setSelectedRecord(null);
  }

  useEffect(() => {
    if (!selectedRecord) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedRecord(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedRecord]);

  return (
    <div style={pageStyles.page}>
      <div style={pageStyles.card}>
        <div style={pageStyles.header}>
          <div>
            <h2 style={pageStyles.title}>2D Plan And Project Requirements</h2>
            <p style={pageStyles.subtitle}>
              Standalone module for uploading 2D plans and capturing architectural requirement details.
            </p>
          </div>
        </div>

        <div style={{ ...pageStyles.result, marginBottom: "1rem" }}>
          This module is intentionally independent for now and does not affect BOQ, pricing, or other flows.
        </div>

        <div style={{ ...pageStyles.formGrid, marginBottom: "1rem" }}>
          <input
            style={pageStyles.input}
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Project name"
          />

          <input
            type="number"
            min={0}
            style={pageStyles.input}
            value={windowsCount}
            onChange={(e) => setWindowsCount(Number(e.target.value))}
            placeholder="Number of windows"
          />

          <input
            type="number"
            min={0}
            style={pageStyles.input}
            value={doorsCount}
            onChange={(e) => setDoorsCount(Number(e.target.value))}
            placeholder="Number of doors"
          />

          <input
            type="number"
            min={1}
            style={pageStyles.input}
            value={floorCount}
            onChange={(e) => setFloorCount(Number(e.target.value))}
            placeholder="Number of floors"
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: 8, color: "#334155", fontWeight: 600 }}>
            Upload 2D Plan (PDF, DWG, DXF, Image)
          </label>
          <input
            type="file"
            accept=".pdf,.dwg,.dxf,image/*"
            onChange={(e) => setPlanFile(e.target.files?.[0] || null)}
            style={pageStyles.input}
          />
          {planFile ? (
            <div style={{ marginTop: 8, color: "#0f766e", fontSize: 14 }}>
              Selected file: {planFile.name}
            </div>
          ) : null}
        </div>

        <div style={{ display: "grid", gap: "1rem", marginBottom: "1rem" }}>
          {DETAIL_SECTIONS.map((section) => (
            <div key={section.title} style={{ border: "1px solid #cbd5e1", borderRadius: "10px", padding: "1rem", background: "#ffffff" }}>
              <h3 style={{ margin: "0 0 0.85rem 0", color: "#0f766e", fontSize: "1rem" }}>{section.title}</h3>
              <div style={{ ...pageStyles.formGrid, marginBottom: 0 }}>
                {section.fields.map((field) => (
                  <div key={field.key} style={{ display: "grid", gap: 6 }}>
                    <label style={{ color: "#334155", fontWeight: 600, fontSize: "0.92rem" }}>
                      {field.label}
                    </label>
                    <textarea
                      style={{
                        ...pageStyles.input,
                        minHeight: 92,
                        resize: "vertical",
                      }}
                      value={additionalDetails[field.key]}
                      onChange={(e) =>
                        setAdditionalDetails((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                      placeholder={field.placeholder}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            style={{ ...pageStyles.primaryBtn, opacity: canSave ? 1 : 0.6 }}
            onClick={handleSave}
            disabled={!canSave}
          >
            Save Requirements
          </button>
          <button type="button" style={pageStyles.secondaryBtn} onClick={handleClearHistory}>
            Clear Saved Records
          </button>
        </div>

        <div style={{ marginTop: "1.2rem" }}>
          <h3 style={{ ...pageStyles.subtitle, marginBottom: 10 }}>Saved Records</h3>
          {records.length === 0 ? (
            <div style={{ color: "#64748b" }}>No saved records yet.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    <th style={pageStyles.th}>Project</th>
                    <th style={pageStyles.th}>Windows</th>
                    <th style={pageStyles.th}>Doors</th>
                    <th style={pageStyles.th}>Floors</th>
                    <th style={pageStyles.th}>2D Plan</th>
                    <th style={pageStyles.th}>Additional Details</th>
                    <th style={{ ...pageStyles.th, textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record, idx) => (
                    <tr key={record.id} style={idx % 2 === 0 ? pageStyles.rowEven : pageStyles.rowOdd}>
                      <td style={pageStyles.td}>{record.projectName}</td>
                      <td style={{ ...pageStyles.td, textAlign: "center" }}>{record.windowsCount}</td>
                      <td style={{ ...pageStyles.td, textAlign: "center" }}>{record.doorsCount}</td>
                      <td style={{ ...pageStyles.td, textAlign: "center" }}>{record.floorCount}</td>
                      <td style={pageStyles.td}>{record.planFileName}</td>
                      <td style={pageStyles.td}>{summarizeAdditionalDetails(record.additionalDetails)}</td>
                      <td style={{ ...pageStyles.td, textAlign: "center" }}>
                        <button
                          type="button"
                          style={{
                            ...pageStyles.secondaryBtn,
                            minHeight: 0,
                            padding: "0.38rem 0.7rem",
                            fontSize: 13,
                          }}
                          onClick={() => setSelectedRecord(record)}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedRecord ? (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: "1rem",
            }}
            onClick={() => setSelectedRecord(null)}
          >
            <div
              style={{
                width: "min(960px, 100%)",
                maxHeight: "88vh",
                overflowY: "auto",
                background: "#ffffff",
                borderRadius: 14,
                border: "1px solid #cbd5e1",
                boxShadow: "0 20px 48px rgba(15, 23, 42, 0.2)",
                padding: "1rem 1rem 1.1rem 1rem",
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <h3 style={{ margin: 0, color: "#0f766e", fontSize: "1.08rem" }}>Requirement Details</h3>
                  <div style={{ marginTop: 6, color: "#334155", fontSize: 14 }}>
                    <strong>{selectedRecord.projectName}</strong>
                    <span style={{ marginLeft: 10 }}>Windows: {selectedRecord.windowsCount}</span>
                    <span style={{ marginLeft: 10 }}>Doors: {selectedRecord.doorsCount}</span>
                    <span style={{ marginLeft: 10 }}>Floors: {selectedRecord.floorCount}</span>
                  </div>
                  <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>
                    2D Plan: {selectedRecord.planFileName} | Saved: {new Date(selectedRecord.createdAt).toLocaleString()}
                  </div>
                </div>
                <button type="button" style={pageStyles.secondaryBtn} onClick={() => setSelectedRecord(null)}>
                  Close
                </button>
              </div>

              <div style={{ display: "grid", gap: "0.9rem", marginTop: "0.95rem" }}>
                {DETAIL_SECTIONS.map((section) => (
                  <div key={section.title} style={{ border: "1px solid #dbe4ee", borderRadius: 10, padding: "0.85rem" }}>
                    <h4 style={{ margin: "0 0 0.7rem 0", color: "#0f766e", fontSize: "0.98rem" }}>{section.title}</h4>
                    <div style={{ display: "grid", gap: "0.55rem" }}>
                      {section.fields.map((field) => {
                        const value = String(selectedRecord.additionalDetails[field.key] || "").trim();
                        return (
                          <div key={field.key} style={{ display: "grid", gridTemplateColumns: "minmax(190px, 240px) 1fr", gap: 8 }}>
                            <div style={{ color: "#334155", fontWeight: 600 }}>{field.label}</div>
                            <div style={{ color: value ? "#0f172a" : "#94a3b8", whiteSpace: "pre-wrap" }}>{value || "-"}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
