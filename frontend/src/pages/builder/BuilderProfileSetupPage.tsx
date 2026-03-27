import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";
import { apiUrl } from "../../services/api";

interface ProfileForm {
  companyName: string;
  contactPhone: string;
  serviceLocations: string;
  specialties: string;
  pastProjects: string;
  portfolioLinks: string;
  teamSize: string;
  minProjectBudget: string;
  isVisibleToArchitects: boolean;
}

const EMPTY: ProfileForm = {
  companyName: "",
  contactPhone: "",
  serviceLocations: "",
  specialties: "",
  pastProjects: "",
  portfolioLinks: "",
  teamSize: "",
  minProjectBudget: "",
  isVisibleToArchitects: false,
};

export default function BuilderProfileSetupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<ProfileForm>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    void loadExisting();
  }, []);

  async function loadExisting() {
    setInitialLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(apiUrl("/api/builder/profile"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setForm({
            companyName: data.companyName || "",
            contactPhone: data.contactPhone || "",
            serviceLocations: data.serviceLocations || "",
            specialties: data.specialties || "",
            pastProjects: data.pastProjects || "",
            portfolioLinks: data.portfolioLinks || "",
            teamSize: data.teamSize != null ? String(data.teamSize) : "",
            minProjectBudget: data.minProjectBudget != null ? String(data.minProjectBudget) : "",
            isVisibleToArchitects: Boolean(data.isVisibleToArchitects),
          });
        }
      }
    } catch {
      // silently ignore — form stays blank
    } finally {
      setInitialLoading(false);
    }
  }

  function set(field: keyof ProfileForm, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.companyName.trim()) { setError("Company / Firm Name is required"); return; }
    if (!form.contactPhone.trim()) { setError("Contact Phone is required"); return; }
    if (!form.serviceLocations.trim()) { setError("Service Locations is required"); return; }
    if (!form.specialties.trim()) { setError("Specialties is required"); return; }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(apiUrl("/api/builder/profile"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          companyName: form.companyName.trim(),
          contactPhone: form.contactPhone.trim(),
          serviceLocations: form.serviceLocations.trim(),
          specialties: form.specialties.trim(),
          pastProjects: form.pastProjects.trim() || null,
          portfolioLinks: form.portfolioLinks.trim() || null,
          teamSize: form.teamSize ? parseInt(form.teamSize, 10) : null,
          minProjectBudget: form.minProjectBudget ? parseFloat(form.minProjectBudget) : null,
          isVisibleToArchitects: form.isVisibleToArchitects,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save profile");

      // Mark profile as complete in local storage
      localStorage.setItem("builder_profile_complete", "1");
      setSuccess("Profile saved successfully!");
      setTimeout(() => navigate("/builder"), 1200);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (initialLoading) {
    return (
      <div style={pageStyles.page}>
        <div style={pageStyles.card}>
          <p style={pageStyles.subtitle}>Loading profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyles.page}>
      <form
        style={{ ...pageStyles.card, maxWidth: 560, margin: "0 auto" }}
        onSubmit={handleSave}
      >
        <div>
          <h2 style={pageStyles.title}>Set Up Your Builder Profile</h2>
          <p style={pageStyles.subtitle}>
            Complete your profile so architects can discover and evaluate your work.
            The four required fields must be filled to access the dashboard.
          </p>
        </div>

        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={labelStyle}>
            Company / Firm Name <Required />
          </label>
          <input
            style={pageStyles.input}
            type="text"
            placeholder="e.g. Sharma Constructions"
            value={form.companyName}
            onChange={(e) => set("companyName", e.target.value)}
            required
          />

          <label style={labelStyle}>
            Contact Phone <Required />
          </label>
          <input
            style={pageStyles.input}
            type="tel"
            placeholder="e.g. +91 98765 43210"
            value={form.contactPhone}
            onChange={(e) => set("contactPhone", e.target.value)}
            required
          />

          <label style={labelStyle}>
            Service Locations <Required />
          </label>
          <input
            style={pageStyles.input}
            type="text"
            placeholder="e.g. Mumbai, Pune, Thane"
            value={form.serviceLocations}
            onChange={(e) => set("serviceLocations", e.target.value)}
            required
          />

          <label style={labelStyle}>
            Specialties <Required />
          </label>
          <input
            style={pageStyles.input}
            type="text"
            placeholder="e.g. Residential, Interiors, Commercial"
            value={form.specialties}
            onChange={(e) => set("specialties", e.target.value)}
            required
          />

          <label style={labelStyle}>Past Projects (optional)</label>
          <textarea
            style={{ ...pageStyles.input, minHeight: 80, resize: "vertical" } as React.CSSProperties}
            placeholder="Briefly describe notable completed projects"
            value={form.pastProjects}
            onChange={(e) => set("pastProjects", e.target.value)}
          />

          <label style={labelStyle}>Portfolio Links (optional)</label>
          <input
            style={pageStyles.input}
            type="text"
            placeholder="e.g. https://portfolio.example.com, https://drive.google.com/…"
            value={form.portfolioLinks}
            onChange={(e) => set("portfolioLinks", e.target.value)}
          />

          <label style={labelStyle}>Team Size (optional)</label>
          <input
            style={pageStyles.input}
            type="number"
            min={1}
            placeholder="e.g. 25"
            value={form.teamSize}
            onChange={(e) => set("teamSize", e.target.value)}
          />

          <label style={labelStyle}>Minimum Project Budget (₹, optional)</label>
          <input
            style={pageStyles.input}
            type="number"
            min={0}
            placeholder="e.g. 500000"
            value={form.minProjectBudget}
            onChange={(e) => set("minProjectBudget", e.target.value)}
          />

          <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={form.isVisibleToArchitects}
              onChange={(e) => set("isVisibleToArchitects", e.target.checked)}
            />
            Make my profile visible to architects in my organization
          </label>
        </section>

        {error && <div style={pageStyles.error}>{error}</div>}
        {success && <div style={{ color: "#0f766e", fontWeight: 600 }}>{success}</div>}

        <button style={pageStyles.primaryBtn} type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save & Go to Dashboard"}
        </button>
      </form>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
};

function Required() {
  return <span style={{ color: "#e11d48", marginLeft: 2 }}>*</span>;
}
