import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { pageStyles } from "../../layouts/pageStyles";
import { apiUrl } from "../../services/api";

type DealerProfile = {
  id: string;
  shopName: string;
  email: string;
  location: string | null;
  contactNumber: string | null;
  city: string | null;
  state: string | null;
  productCategoryIds?: string[];
};

type MaterialCategory = {
  id: string;
  name: string;
};

type ProfileFormState = {
  shopName: string;
  email: string;
  location: string;
  contactNumber: string;
  city: string;
  state: string;
};

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function DealerProfilePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [form, setForm] = useState<ProfileFormState>({
    shopName: "",
    email: "",
    location: "",
    contactNumber: "",
    city: "",
    state: "",
  });

  useEffect(() => {
    void loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setError("");

    try {
      const [profileRes, categoriesRes] = await Promise.all([
        fetch(apiUrl("/api/prices/dealers/profile"), {
          headers: authHeaders(),
        }),
        fetch(apiUrl("/api/prices/categories")),
      ]);

      if (!profileRes.ok) {
        const data = await profileRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load profile");
      }

      const data = (await profileRes.json()) as DealerProfile;
      setForm({
        shopName: String(data.shopName || ""),
        email: String(data.email || ""),
        location: String(data.location || ""),
        contactNumber: String(data.contactNumber || ""),
        city: String(data.city || ""),
        state: String(data.state || ""),
      });

      const selectedIds = Array.isArray(data.productCategoryIds)
        ? data.productCategoryIds.map((id) => String(id)).filter(Boolean)
        : [];
      setSelectedCategoryIds(selectedIds);

      if (categoriesRes.ok) {
        const categoryRows = await categoriesRes.json();
        const categoryOptions = Array.isArray(categoryRows)
          ? categoryRows
              .map((row: any) => ({
                id: String(row?.id || ""),
                name: String(row?.name || ""),
              }))
              .filter((row: MaterialCategory) => row.id && row.name)
          : [];
        setCategories(categoryOptions);
      } else {
        setCategories([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof ProfileFormState>(field: K, value: ProfileFormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleCategory(categoryId: string) {
    setSelectedCategoryIds((prev) => {
      if (prev.includes(categoryId)) {
        return prev.filter((id) => id !== categoryId);
      }
      return [...prev, categoryId];
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.shopName.trim()) {
      setError("Shop name is required");
      return;
    }

    if (!form.email.trim()) {
      setError("Email is required");
      return;
    }

    if (selectedCategoryIds.length === 0) {
      setError("Please select at least one material category that you supply");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/prices/dealers/profile"), {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          shopName: form.shopName.trim(),
          email: form.email.trim(),
          location: form.location.trim() || null,
          contactNumber: form.contactNumber.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          productCategoryIds: selectedCategoryIds,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update profile");
      }

      setSuccess("Profile updated successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={pageStyles.page}>
      <div style={{ ...pageStyles.card, maxWidth: 760 }}>
        <h1 style={pageStyles.title}>Edit Supplier Profile</h1>
        <p style={pageStyles.subtitle}>Update your business details shown to architects and buyers.</p>

        {loading ? (
          <p style={pageStyles.subtitle}>Loading profile...</p>
        ) : (
          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
            <div style={pageStyles.formGrid}>
              <div style={pageStyles.field}>
                <label style={pageStyles.label}>Shop Name</label>
                <input
                  style={pageStyles.input}
                  value={form.shopName}
                  onChange={(e) => updateField("shopName", e.target.value)}
                  required
                />
              </div>

              <div style={pageStyles.field}>
                <label style={pageStyles.label}>Email</label>
                <input
                  type="email"
                  style={pageStyles.input}
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  required
                />
              </div>

              <div style={pageStyles.field}>
                <label style={pageStyles.label}>Contact Number</label>
                <input
                  style={pageStyles.input}
                  value={form.contactNumber}
                  onChange={(e) => updateField("contactNumber", e.target.value)}
                />
              </div>

              <div style={pageStyles.field}>
                <label style={pageStyles.label}>Location</label>
                <input
                  style={pageStyles.input}
                  value={form.location}
                  onChange={(e) => updateField("location", e.target.value)}
                />
              </div>

              <div style={pageStyles.field}>
                <label style={pageStyles.label}>City</label>
                <input
                  style={pageStyles.input}
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
                />
              </div>

              <div style={pageStyles.field}>
                <label style={pageStyles.label}>State</label>
                <input
                  style={pageStyles.input}
                  value={form.state}
                  onChange={(e) => updateField("state", e.target.value)}
                />
              </div>
            </div>

            <div style={pageStyles.field}>
              <label style={pageStyles.label}>Materials You Supply</label>
              {categories.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: 13 }}>No categories available.</div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 8,
                    padding: 10,
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    background: "#f8fafc",
                  }}
                >
                  {categories.map((category) => (
                    <label
                      key={category.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 14,
                        color: "#334155",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCategoryIds.includes(category.id)}
                        onChange={() => toggleCategory(category.id)}
                      />
                      {category.name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {error ? <div style={{ color: "#b91c1c", fontWeight: 600 }}>{error}</div> : null}
            {success ? <div style={{ color: "#0f766e", fontWeight: 600 }}>{success}</div> : null}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                type="button"
                style={pageStyles.secondaryBtn}
                onClick={() => navigate("/prices")}
                disabled={saving}
              >
                Back
              </button>
              <button type="submit" style={pageStyles.primaryBtn} disabled={saving}>
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
