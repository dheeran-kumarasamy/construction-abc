import { useEffect, useRef, useState } from "react";
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
  portfolioPhotos: string[];
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
  portfolioPhotos: [],
};

export default function BuilderProfileSetupPage() {
  const navigate = useNavigate();
  const didLoadRef = useRef(false);
  const [form, setForm] = useState<ProfileForm>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);

  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    void loadExisting();
  }, []);

  function clearSessionAndRedirect() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("auth_user");
    localStorage.removeItem("builder_profile_complete");
    navigate("/login", { replace: true });
  }

  async function loadExisting() {
    setInitialLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token || token === "undefined" || token === "null") {
        clearSessionAndRedirect();
        return;
      }

      const res = await fetch(apiUrl("/api/builder/profile"), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        clearSessionAndRedirect();
        return;
      }

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
            portfolioPhotos: Array.isArray(data.portfolioPhotos) ? data.portfolioPhotos : [],
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

  function removePortfolioPhoto(photoPath: string) {
    setForm((prev) => ({
      ...prev,
      portfolioPhotos: prev.portfolioPhotos.filter((item) => item !== photoPath),
    }));
  }

  function handlePhotoSelection(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const oversized = files.find((file) => file.size > 5 * 1024 * 1024);
    if (oversized) {
      setError("Each portfolio photo must be 5MB or smaller");
      e.target.value = "";
      return;
    }

    const total = form.portfolioPhotos.length + pendingPhotos.length + files.length;
    if (total > 10) {
      setError("You can keep a maximum of 10 portfolio photos");
      e.target.value = "";
      return;
    }

    setError("");
    setPendingPhotos((prev) => [...prev, ...files]);
    e.target.value = "";
  }

  function removePendingPhoto(index: number) {
    setPendingPhotos((prev) => prev.filter((_, idx) => idx !== index));
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
      if (!token || token === "undefined" || token === "null") {
        clearSessionAndRedirect();
        return;
      }

      const res = await fetch(apiUrl("/api/builder/profile"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyName: form.companyName.trim(),
          contactPhone: form.contactPhone.trim(),
          serviceLocations: form.serviceLocations.trim(),
          specialties: form.specialties.trim(),
          pastProjects: form.pastProjects.trim() || null,
          portfolioLinks: form.portfolioLinks.trim() || null,
          portfolioPhotos: form.portfolioPhotos,
          teamSize: form.teamSize ? parseInt(form.teamSize, 10) : null,
          minProjectBudget: form.minProjectBudget ? parseFloat(form.minProjectBudget) : null,
          isVisibleToArchitects: form.isVisibleToArchitects,
        }),
      });

      if (res.status === 401) {
        clearSessionAndRedirect();
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save profile");

      let mergedPhotos = Array.isArray(data.portfolioPhotos) ? data.portfolioPhotos : form.portfolioPhotos;

      if (pendingPhotos.length > 0) {
        const uploadForm = new FormData();
        pendingPhotos.forEach((file) => uploadForm.append("photos", file));

        const uploadRes = await fetch(apiUrl("/api/builder/profile/photos"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: uploadForm,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || "Failed to upload portfolio photos");
        }

        mergedPhotos = Array.isArray(uploadData.portfolioPhotos) ? uploadData.portfolioPhotos : mergedPhotos;
        setPendingPhotos([]);
      }

      setForm((prev) => ({
        ...prev,
        portfolioPhotos: mergedPhotos,
      }));

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

          <label style={labelStyle}>Portfolio Photos (max 10, up to 5MB each)</label>
          <input
            style={pageStyles.input}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoSelection}
          />

          {form.portfolioPhotos.length > 0 && (
            <div style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Saved Photos</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
                {form.portfolioPhotos.map((photoPath) => (
                  <div key={photoPath} style={{ display: "grid", gap: 6 }}>
                    <img
                      src={apiUrl(`/uploads/${photoPath}`)}
                      alt="Portfolio"
                      style={{ width: "100%", height: 88, objectFit: "cover", borderRadius: 8, border: "1px solid #d1d5db" }}
                    />
                    <button
                      type="button"
                      style={{ ...pageStyles.secondaryBtn, fontSize: 12, minHeight: 30 }}
                      onClick={() => removePortfolioPhoto(photoPath)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingPhotos.length > 0 && (
            <div style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Pending Upload</span>
              <div style={{ display: "grid", gap: 6 }}>
                {pendingPhotos.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      padding: "8px 10px",
                      background: "#f9fafb",
                    }}
                  >
                    <span style={{ fontSize: 12, color: "#374151", overflowWrap: "anywhere" }}>{file.name}</span>
                    <button
                      type="button"
                      style={{ ...pageStyles.secondaryBtn, fontSize: 12, minHeight: 28, padding: "0 10px" }}
                      onClick={() => removePendingPhoto(index)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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
