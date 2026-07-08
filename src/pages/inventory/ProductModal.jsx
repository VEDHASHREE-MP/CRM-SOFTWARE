import { useState, useEffect } from "react";

const DEFAULT_CATEGORIES = [
  "Hardware","Software","Accessories","Components",
  "Peripherals","Networking","Storage","Other",
];

export default function ProductModal({ data, categories = DEFAULT_CATEGORIES, onSave, onClose }) {
  const isEdit = !!data;

  const [form, setForm] = useState({
    name:                "",
    category:            "Hardware",
    customCategory:      "",
    description:         "",
    selling_price:       "",
    cost_price:          "",
    opening_stock:       "",
    low_stock_threshold: "5",
    is_active:           true,
  });
  const [useCustomCat, setUseCustomCat] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (data) {
      const knownCat = DEFAULT_CATEGORIES.includes(data.category);
      setForm({
        name:                data.name || "",
        category:            knownCat ? data.category : "Custom",
        customCategory:      knownCat ? "" : data.category,
        description:         data.description || "",
        selling_price:       data.selling_price ?? "",
        cost_price:          data.cost_price ?? "",
        opening_stock:       data.current_stock ?? "",
        low_stock_threshold: data.low_stock_threshold ?? "5",
        is_active:           data.is_active ?? true,
      });
      setUseCustomCat(!knownCat);
    }
  }, [data]);

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Product name is required";
    if (!form.selling_price && form.selling_price !== 0) e.selling_price = "Required";
    if (!form.cost_price && form.cost_price !== 0) e.cost_price = "Required";
    if (useCustomCat && !form.customCategory.trim()) e.customCategory = "Enter category name";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      const payload = {
        name:                form.name.trim(),
        category:            useCustomCat ? form.customCategory.trim() : form.category,
        description:         form.description.trim(),
        selling_price:       parseFloat(form.selling_price) || 0,
        cost_price:          parseFloat(form.cost_price) || 0,
        opening_stock:       parseFloat(form.opening_stock) || 0,
        low_stock_threshold: parseFloat(form.low_stock_threshold) || 5,
        is_active:           form.is_active,
      };
      await onSave(payload, data?.id || null);
    } finally {
      setSaving(false);
    }
  };

  const s = {
    overlay: {
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 20,
    },
    modal: {
      background: "#fff", borderRadius: 16,
      width: "100%", maxWidth: 560,
      maxHeight: "90vh", overflowY: "auto",
      boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
    },
    header: {
      padding: "20px 24px 16px",
      borderBottom: "1px solid #e8eaed",
      display: "flex", justifyContent: "space-between", alignItems: "center",
    },
    title: { fontSize: 18, fontWeight: 700, color: "#1a1a2e", margin: 0 },
    body: { padding: "20px 24px" },
    footer: {
      padding: "16px 24px",
      borderTop: "1px solid #e8eaed",
      display: "flex", justifyContent: "flex-end", gap: 10,
    },
    row: { marginBottom: 16 },
    label: {
      display: "block", fontSize: 13, fontWeight: 600,
      color: "#374151", marginBottom: 5,
    },
    input: {
      width: "100%", padding: "9px 12px",
      border: "1px solid #d1d5db", borderRadius: 8,
      fontSize: 14, outline: "none", boxSizing: "border-box",
      transition: "border 0.15s",
    },
    inputError: { borderColor: "#ef4444" },
    errorMsg: { fontSize: 12, color: "#ef4444", marginTop: 4 },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    btn: (v = "primary") => ({
      padding: "9px 22px", borderRadius: 8, border: "none",
      fontWeight: 600, fontSize: 14, cursor: "pointer",
      ...(v === "primary"
        ? { background: "#4f46e5", color: "#fff" }
        : { background: "#f3f4f6", color: "#374151" }),
    }),
    closeBtn: {
      background: "none", border: "none", fontSize: 20,
      cursor: "pointer", color: "#9ca3af", lineHeight: 1,
    },
    toggle: {
      display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
    },
    sectionTitle: {
      fontSize: 12, fontWeight: 700, color: "#6b7280",
      textTransform: "uppercase", letterSpacing: "0.05em",
      margin: "20px 0 12px", paddingTop: 16,
      borderTop: "1px solid #f3f4f6",
    },
  };

  const Field = ({ label, name, type = "text", placeholder, required, half }) => (
    <div style={half ? {} : s.row}>
      <label style={s.label}>{label}{required && <span style={{ color: "#ef4444" }}> *</span>}</label>
      <input
        style={{ ...s.input, ...(errors[name] ? s.inputError : {}) }}
        type={type}
        placeholder={placeholder}
        value={form[name]}
        onChange={e => set(name, e.target.value)}
        onFocus={e => e.target.style.borderColor = "#4f46e5"}
        onBlur={e => e.target.style.borderColor = errors[name] ? "#ef4444" : "#d1d5db"}
      />
      {errors[name] && <div style={s.errorMsg}>{errors[name]}</div>}
    </div>
  );

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        {/* Header */}
        <div style={s.header}>
          <h2 style={s.title}>{isEdit ? "✏️ Edit Product" : "📦 Add New Product"}</h2>
          <button style={s.closeBtn} onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div style={s.body}>
          {/* Basic Info */}
          <div style={s.row}>
            <label style={s.label}>Product Name <span style={{ color: "#ef4444" }}>*</span></label>
            <input
              style={{ ...s.input, ...(errors.name ? s.inputError : {}) }}
              placeholder="e.g. Laptop RAM 8GB"
              value={form.name}
              onChange={e => set("name", e.target.value)}
              onFocus={e => e.target.style.borderColor = "#4f46e5"}
              onBlur={e => e.target.style.borderColor = errors.name ? "#ef4444" : "#d1d5db"}
            />
            {errors.name && <div style={s.errorMsg}>{errors.name}</div>}
          </div>

          {/* Category */}
          <div style={s.row}>
            <label style={s.label}>Category <span style={{ color: "#ef4444" }}>*</span></label>
            <select
              style={s.input}
              value={useCustomCat ? "Custom" : form.category}
              onChange={e => {
                if (e.target.value === "Custom") {
                  setUseCustomCat(true);
                  set("category", "Custom");
                } else {
                  setUseCustomCat(false);
                  set("category", e.target.value);
                }
              }}
            >
              {[...DEFAULT_CATEGORIES, "Custom"].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {useCustomCat && (
              <div style={{ marginTop: 8 }}>
                <input
                  style={{ ...s.input, ...(errors.customCategory ? s.inputError : {}) }}
                  placeholder="Enter custom category..."
                  value={form.customCategory}
                  onChange={e => set("customCategory", e.target.value)}
                  autoFocus
                />
                {errors.customCategory && <div style={s.errorMsg}>{errors.customCategory}</div>}
              </div>
            )}
          </div>

          {/* Description */}
          <div style={s.row}>
            <label style={s.label}>Description</label>
            <textarea
              style={{ ...s.input, minHeight: 72, resize: "vertical", fontFamily: "inherit" }}
              placeholder="Optional product description..."
              value={form.description}
              onChange={e => set("description", e.target.value)}
            />
          </div>



          {/* Pricing */}
          <div style={s.sectionTitle}>💰 Pricing</div>
          <div style={s.grid2}>
            <div>
              <label style={s.label}>Cost Price (₹) <span style={{ color: "#ef4444" }}>*</span></label>
              <input
                style={{ ...s.input, ...(errors.cost_price ? s.inputError : {}) }}
                type="number" min="0" step="0.01" placeholder="0.00"
                value={form.cost_price}
                onChange={e => set("cost_price", e.target.value)}
              />
              {errors.cost_price && <div style={s.errorMsg}>{errors.cost_price}</div>}
            </div>
            <div>
              <label style={s.label}>Selling Price (₹) <span style={{ color: "#ef4444" }}>*</span></label>
              <input
                style={{ ...s.input, ...(errors.selling_price ? s.inputError : {}) }}
                type="number" min="0" step="0.01" placeholder="0.00"
                value={form.selling_price}
                onChange={e => set("selling_price", e.target.value)}
              />
              {errors.selling_price && <div style={s.errorMsg}>{errors.selling_price}</div>}
            </div>
          </div>

          {/* Stock */}
          <div style={s.sectionTitle}>📦 Stock Settings</div>
          <div style={s.grid2}>
            <div>
              <label style={s.label}>{isEdit ? "Current Stock" : "Opening Stock"}</label>
              <input
                style={s.input}
                type="number" min="0" step="0.01"
                placeholder="0"
                value={form.opening_stock}
                onChange={e => set("opening_stock", e.target.value)}

              />

            </div>
            <div>
              <label style={s.label}>Low Stock Alert At</label>
              <input
                style={s.input}
                type="number" min="0" step="1"
                placeholder="5"
                value={form.low_stock_threshold}
                onChange={e => set("low_stock_threshold", e.target.value)}
              />
            </div>
          </div>

          {/* Active toggle (edit only) */}
          {isEdit && (
            <div style={{ marginTop: 16 }}>
              <label style={{ ...s.toggle }}>
                <div style={{
                  width: 40, height: 22, borderRadius: 11, position: "relative",
                  background: form.is_active ? "#4f46e5" : "#d1d5db",
                  transition: "background 0.2s", cursor: "pointer",
                }} onClick={() => set("is_active", form.is_active ? false : true)}>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%",
                    background: "#fff", position: "absolute",
                    top: 2, left: form.is_active ? 20 : 2,
                    transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>
                  Product is {form.is_active ? "Active" : "Inactive"}
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={s.footer}>
          <button style={s.btn("outline")} onClick={onClose} disabled={saving}>Cancel</button>
          <button style={s.btn("primary")} onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Product"}
          </button>
        </div>
      </div>
    </div>
  );
}