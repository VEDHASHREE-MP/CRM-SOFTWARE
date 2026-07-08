import { useState, useEffect } from "react";

export default function PurchaseModal({ products = [], onSave, onClose, editData = null }) {
  const today = new Date().toISOString().split("T")[0];
  const isEdit = !!editData;

  const [form, setForm] = useState({
    product_id:    editData?.product_id?.toString() || "",
    quantity:      editData?.quantity?.toString()    || "",
    unit_cost:     editData?.unit_cost?.toString()   || "",
    purchase_date: editData?.purchase_date           || today,
    invoice_ref:   editData?.invoice_ref             || "",
    notes:         editData?.notes                   || "",
  });
  const [saving, setSaving]                   = useState(false);
  const [errors, setErrors]                   = useState({});
  const [selectedProduct, setSelectedProduct] = useState(null);

  // When product changes — set selectedProduct AND auto-fill unit_cost from selling_price
  useEffect(() => {
    if (form.product_id) {
      const p = products.find(p => p.id === parseInt(form.product_id));
      setSelectedProduct(p || null);
      if (p && !isEdit) {
        setForm(f => ({ ...f, unit_cost: p.selling_price.toString() }));
      }
    } else {
      setSelectedProduct(null);
    }
  }, [form.product_id, products]);

  const totalCost = (parseFloat(form.quantity) || 0) * (parseFloat(form.unit_cost) || 0);

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.product_id)
      e.product_id = "Select a product";
    if (!form.quantity || parseInt(form.quantity) <= 0 || !Number.isInteger(parseFloat(form.quantity)))
      e.quantity = "Quantity must be a whole number";
    if (form.unit_cost === "" || parseFloat(form.unit_cost) < 0)
      e.unit_cost = "Enter valid price";
    if (!form.purchase_date)
      e.purchase_date = "Required";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await onSave({
        product_id:    parseInt(form.product_id),
        quantity:      parseInt(form.quantity),
        unit_cost:     parseFloat(form.unit_cost),
        purchase_date: form.purchase_date,
        invoice_ref:   form.invoice_ref.trim(),
        notes:         form.notes.trim(),
      });
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
      width: "100%", maxWidth: 500,
      boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      maxHeight: "90vh", overflowY: "auto",
    },
    header: {
      padding: "20px 24px 16px",
      borderBottom: "1px solid #e8eaed",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      position: "sticky", top: 0, background: "#fff", zIndex: 1,
    },
    title:   { fontSize: 18, fontWeight: 700, color: "#1a1a2e", margin: 0 },
    body:    { padding: "20px 24px" },
    footer:  {
      padding: "16px 24px", borderTop: "1px solid #e8eaed",
      display: "flex", justifyContent: "flex-end", gap: 10,
      position: "sticky", bottom: 0, background: "#fff",
    },
    row:     { marginBottom: 16 },
    label:   { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 5 },
    input:   {
      width: "100%", padding: "9px 12px",
      border: "1px solid #d1d5db", borderRadius: 8,
      fontSize: 14, outline: "none", boxSizing: "border-box",
    },
    inputErr:  { borderColor: "#ef4444" },
    errorMsg:  { fontSize: 12, color: "#ef4444", marginTop: 4 },
    grid2:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 },
    btn: (v = "primary") => ({
      padding: "9px 22px", borderRadius: 8, border: "none",
      fontWeight: 600, fontSize: 14, cursor: "pointer",
      ...(v === "primary"
        ? { background: isEdit ? "#4f46e5" : "#059669", color: "#fff" }
        : { background: "#f3f4f6", color: "#374151" }),
    }),
    closeBtn: {
      background: "none", border: "none", fontSize: 20,
      cursor: "pointer", color: "#9ca3af", lineHeight: 1,
    },
    productCard: {
      background: "#f0fdf4", border: "1px solid #bbf7d0",
      borderRadius: 8, padding: "10px 14px", marginBottom: 16,
      fontSize: 13,
    },
    autofillNote: {
      fontSize: 11, color: "#059669", marginTop: 4, fontStyle: "italic",
    },
    totalBox: {
      background: "#f0f9ff", border: "1px solid #bae6fd",
      borderRadius: 8, padding: "12px 16px",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      marginTop: 16,
    },
    stockWarning: {
      background: "#fff7ed", border: "1px solid #fed7aa",
      borderRadius: 8, padding: "8px 12px", marginBottom: 12,
      fontSize: 12, color: "#c2410c",
    },
  };

  const qtyNum     = parseFloat(form.quantity) || 0;
  const stockShort = selectedProduct && qtyNum > selectedProduct.current_stock;

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        {/* Header */}
        <div style={s.header}>
          <h2 style={s.title}>
            {isEdit ? "✏️ Edit Purchase Entry" : "🛒 Record Purchase Entry"}
          </h2>
          <button style={s.closeBtn} onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div style={s.body}>

          {/* Product Select */}
          <div style={s.row}>
            <label style={s.label}>Product <span style={{ color: "#ef4444" }}>*</span></label>
            <select
              style={{ ...s.input, ...(errors.product_id ? s.inputErr : {}), background: isEdit ? "#f9fafb" : "#fff" }}
              value={form.product_id}
              onChange={e => set("product_id", e.target.value)}
              disabled={isEdit}
            >
              <option value="">— Select product —</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} — Stock: {p.current_stock}
                </option>
              ))}
            </select>
            {errors.product_id && <div style={s.errorMsg}>{errors.product_id}</div>}
          </div>

          {/* Product info chip */}
          {selectedProduct && (
            <div style={s.productCard}>
              <strong>{selectedProduct.name}</strong>
              &nbsp;·&nbsp; Category: {selectedProduct.category}
              &nbsp;·&nbsp; Current stock:{" "}
              <strong style={{ color: selectedProduct.current_stock <= selectedProduct.low_stock_threshold ? "#ef4444" : "#059669" }}>
                {selectedProduct.current_stock}
              </strong>
              &nbsp;·&nbsp; Cost price: ₹{selectedProduct.cost_price}
              &nbsp;·&nbsp; Selling price: ₹{selectedProduct.selling_price}
            </div>
          )}

          {/* Low stock warning */}
          {stockShort && (
            <div style={s.stockWarning}>
              ⚠️ Not enough stock — you need {qtyNum} but only {selectedProduct.current_stock} available
            </div>
          )}

          {/* Quantity + Unit Cost */}
          <div style={s.grid2}>
            <div>
              <label style={s.label}>Quantity <span style={{ color: "#ef4444" }}>*</span></label>
              <input
                style={{ ...s.input, ...(errors.quantity ? s.inputErr : {}) }}
                type="number" min="1" step="1" placeholder="0"
                value={form.quantity}
                onChange={e => set("quantity", e.target.value)}
              />
              {errors.quantity && <div style={s.errorMsg}>{errors.quantity}</div>}
            </div>
            <div>
              <label style={s.label}>Unit Price (₹) <span style={{ color: "#ef4444" }}>*</span></label>
              <input
                style={{ ...s.input, ...(errors.unit_cost ? s.inputErr : {}) }}
                type="number" min="0" step="0.01" placeholder="0.00"
                value={form.unit_cost}
                onChange={e => set("unit_cost", e.target.value)}
              />
              {errors.unit_cost && <div style={s.errorMsg}>{errors.unit_cost}</div>}
              {selectedProduct && !isEdit && (
                <div style={s.autofillNote}>
                  ✓ Auto-filled from selling price (₹{selectedProduct.selling_price})
                </div>
              )}
            </div>
          </div>

          {/* Total */}
          {(form.quantity || form.unit_cost) && (
            <div style={s.totalBox}>
              <span style={{ fontSize: 13, color: "#0369a1", fontWeight: 500 }}>Total Value</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#0c4a6e" }}>
                ₹{totalCost.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Purchase Date */}
          <div style={{ ...s.row, marginTop: 16 }}>
            <label style={s.label}>Date <span style={{ color: "#ef4444" }}>*</span></label>
            <input
              style={{ ...s.input, ...(errors.purchase_date ? s.inputErr : {}) }}
              type="date"
              value={form.purchase_date}
              onChange={e => set("purchase_date", e.target.value)}
            />
            {errors.purchase_date && <div style={s.errorMsg}>{errors.purchase_date}</div>}
          </div>

          {/* Invoice Ref */}
          <div style={s.row}>
            <label style={s.label}>Invoice Ref <span style={{ color: "#9ca3af", fontWeight: 400 }}>(optional)</span></label>
            <input
              style={s.input}
              type="text" placeholder="e.g. INV-2024-001"
              value={form.invoice_ref}
              onChange={e => set("invoice_ref", e.target.value)}
            />
          </div>

          {/* Notes */}
          <div style={s.row}>
            <label style={s.label}>Notes <span style={{ color: "#9ca3af", fontWeight: 400 }}>(optional)</span></label>
            <textarea
              style={{ ...s.input, minHeight: 60, resize: "vertical", fontFamily: "inherit" }}
              placeholder="Any additional notes..."
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={s.footer}>
          <button style={s.btn("outline")} onClick={onClose} disabled={saving}>Cancel</button>
          <button style={s.btn("primary")} onClick={handleSubmit} disabled={saving || stockShort}>
            {saving ? "Saving..." : isEdit ? "💾 Save Changes" : "✅ Record Purchase"}
          </button>
        </div>
      </div>
    </div>
  );
}