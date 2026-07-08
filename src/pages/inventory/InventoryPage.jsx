import { useState, useEffect, useCallback } from "react";
import ProductModal from "./ProductModal";
import PurchaseModal from "./PurchaseModal";

const API = "http://localhost:5000/api/inventory";

const getToken = () => localStorage.getItem("vtcrm_token");

const apiFetch = async (path, opts = {}) => {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
};

const DEFAULT_CATEGORIES = [
  "Hardware","Software","Accessories","Components",
  "Peripherals","Networking","Storage","Other",
];

// ── Small reusable components ────────────────────────────────────────────────

const StatCard = ({ icon, label, value, accent, sub }) => (
  <div style={{
    background: "#fff",
    border: "1px solid #e8eaed",
    borderRadius: 12,
    padding: "20px 24px",
    display: "flex",
    alignItems: "flex-start",
    gap: 16,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  }}>
    <div style={{
      width: 44, height: 44, borderRadius: 10,
      background: accent + "18",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 20, flexShrink: 0,
    }}>{icon}</div>
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a2e", lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: accent, marginTop: 4, fontWeight: 500 }}>{sub}</div>}
    </div>
  </div>
);

const Badge = ({ text, color }) => {
  const colors = {
    green:  { bg: "#d1fae5", text: "#065f46" },
    red:    { bg: "#fee2e2", text: "#991b1b" },
    yellow: { bg: "#fef3c7", text: "#92400e" },
    gray:   { bg: "#f3f4f6", text: "#4b5563" },
    blue:   { bg: "#dbeafe", text: "#1e40af" },
  };
  const c = colors[color] || colors.gray;
  return (
    <span style={{
      background: c.bg, color: c.text,
      padding: "2px 10px", borderRadius: 20,
      fontSize: 12, fontWeight: 600,
    }}>{text}</span>
  );
};

// ── Main Page ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [tab, setTab]               = useState("products");
  const [products, setProducts]     = useState([]);
  const [purchases, setPurchases]   = useState([]);
  const [stats, setStats]           = useState(null);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [filterCat, setFilterCat]   = useState("");
  const [filterStatus, setFilterStatus] = useState("active");

  // Modals
  const [productModal, setProductModal]   = useState({ open: false, data: null });
  const [purchaseModal, setPurchaseModal] = useState({ open: false, editData: null });
  const [historyProduct, setHistoryProduct] = useState(null);

  // ── Data loaders ─────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s, cats] = await Promise.all([
        apiFetch("/products/"),
        apiFetch("/stats/summary"),
        apiFetch("/products/categories"),
      ]);
      setProducts(p);
      setStats(s);
      setCategories(cats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPurchases = useCallback(async (productId = "") => {
    try {
      const path = productId ? `/purchases/${productId}/history` : "/purchases/";
      const data = await apiFetch(path);
      setPurchases(data);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => {
    if (tab === "purchases") loadPurchases(historyProduct?.id || "");
  }, [tab, historyProduct, loadPurchases]);

  // ── Filtered products ────────────────────────────────────────────────────
  const filteredProducts = products.filter(p => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description || "").toLowerCase().includes(search.toLowerCase());
    const matchCat    = !filterCat || p.category === filterCat;
    const matchStatus = filterStatus === "all"      ? true
                      : filterStatus === "active"   ? p.is_active === true || p.is_active === 1
                      : p.is_active === false || p.is_active === 0;
    return matchSearch && matchCat && matchStatus;
  });

  const lowStockProducts = products.filter(
    p => (p.is_active === true || p.is_active === 1) && Number(p.current_stock) <= Number(p.low_stock_threshold)
  );

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSaveProduct = async (formData, editId) => {
    try {
      if (editId) {
        await apiFetch(`/products/${editId}`, {
          method: "PUT", body: JSON.stringify(formData),
        });
      } else {
        await apiFetch("/products/", {
          method: "POST", body: JSON.stringify(formData),
        });
      }
      setProductModal({ open: false, data: null });
      await loadAll();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm("Deactivate this product?")) return;
    try {
      await apiFetch(`/products/${id}`, { method: "DELETE" });
      await loadAll();
    } catch (e) { alert(e.message); }
  };

  const handleSavePurchase = async (formData, editId = null) => {
    try {
      if (editId) {
        await apiFetch(`/purchases/${editId}`, { method: "PUT", body: JSON.stringify(formData) });
      } else {
        await apiFetch("/purchases/", { method: "POST", body: JSON.stringify(formData) });
      }
      setPurchaseModal({ open: false, editData: null });
      await loadAll();
      if (tab === "purchases") loadPurchases(historyProduct?.id || "");
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDeletePurchase = async (entry) => {
    if (!window.confirm(
      `Delete this purchase entry?\n\nProduct: ${entry.product_name}\nQty: ${entry.quantity}\nStock will be restored.`
    )) return;
    try {
      await apiFetch(`/purchases/${entry.id}`, { method: "DELETE" });
      await loadAll();
      loadPurchases(historyProduct?.id || "");
    } catch (e) {
      alert(e.message);
    }
  };

  // ── Styles ───────────────────────────────────────────────────────────────
  const s = {
    page: {
      minHeight: "100vh",
      background: "#f7f8fc",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      padding: "28px 32px",
    },
    header: {
      display: "flex", justifyContent: "space-between",
      alignItems: "flex-start", marginBottom: 24,
    },
    title:    { fontSize: 26, fontWeight: 800, color: "#1a1a2e", margin: 0 },
    subtitle: { fontSize: 14, color: "#6b7280", marginTop: 4 },
    btn: (variant = "primary") => ({
      padding: "9px 20px", borderRadius: 8, border: "none",
      fontWeight: 600, fontSize: 14, cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 6,
      ...(variant === "primary"
        ? { background: "#4f46e5", color: "#fff" }
        : variant === "success"
        ? { background: "#059669", color: "#fff" }
        : { background: "#fff", color: "#374151", border: "1px solid #d1d5db" }),
    }),
    statsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: 16, marginBottom: 24,
    },
    alertBanner: {
      background: "#fff7ed", border: "1px solid #fed7aa",
      borderRadius: 10, padding: "12px 18px",
      display: "flex", alignItems: "center", gap: 10,
      marginBottom: 20,
    },
    tabs: {
      display: "flex", gap: 4, marginBottom: 20,
      borderBottom: "2px solid #e8eaed", paddingBottom: 0,
    },
    tab: (active) => ({
      padding: "10px 20px", border: "none", background: "none",
      fontWeight: active ? 700 : 500,
      color: active ? "#4f46e5" : "#6b7280",
      borderBottom: active ? "2px solid #4f46e5" : "2px solid transparent",
      marginBottom: -2, cursor: "pointer", fontSize: 14,
      transition: "all 0.15s",
    }),
    toolbar: {
      display: "flex", gap: 10, marginBottom: 16,
      flexWrap: "wrap", alignItems: "center",
    },
    input: {
      padding: "8px 12px", border: "1px solid #d1d5db",
      borderRadius: 8, fontSize: 14, background: "#fff",
      outline: "none",
    },
    table: {
      width: "100%", borderCollapse: "collapse",
      background: "#fff", borderRadius: 12,
      overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    },
    th: {
      padding: "12px 16px", textAlign: "left",
      fontSize: 12, fontWeight: 700, color: "#6b7280",
      background: "#f9fafb", borderBottom: "1px solid #e8eaed",
      textTransform: "uppercase", letterSpacing: "0.05em",
    },
    td: {
      padding: "13px 16px", borderBottom: "1px solid #f3f4f6",
      fontSize: 14, color: "#374151",
    },
    iconBtn: (color = "#4f46e5") => ({
      background: "none", border: "none", cursor: "pointer",
      color, fontSize: 16, padding: "4px 6px", borderRadius: 6,
      transition: "background 0.1s",
    }),
  };

  if (loading) return (
    <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", color: "#6b7280" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⚙️</div>
        <div>Loading inventory...</div>
      </div>
    </div>
  );

  return (
    <div style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>📦 Inventory</h1>
          <p style={s.subtitle}>Manage products and stock levels</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={s.btn("success")} onClick={() => setPurchaseModal({ open: true })}>
            + Record Purchase
          </button>
          <button style={s.btn("primary")} onClick={() => setProductModal({ open: true, data: null })}>
            + Add Product
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div style={s.statsGrid}>
          <StatCard icon="📦" label="Total Products"     value={stats.total_products}                    accent="#4f46e5" />
          <StatCard icon="⚠️" label="Low Stock Alerts"   value={stats.low_stock_count}                   accent="#ef4444"
            sub={stats.low_stock_count > 0 ? "Needs attention" : "All good"} />
          <StatCard icon="💰" label="Stock Value (Cost)"  value={`₹${Number(stats.stock_value).toLocaleString()}`} accent="#059669" />
          <StatCard icon="🛒" label="Purchase Entries"    value={stats.total_purchases}                   accent="#0891b2" />
        </div>
      )}

      {/* Low Stock Banner */}
      {lowStockProducts.length > 0 && (
        <div style={s.alertBanner}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <strong style={{ color: "#9a3412" }}>Low Stock Alert: </strong>
            <span style={{ color: "#c2410c", fontSize: 14 }}>
              {lowStockProducts.slice(0, 4).map(p =>
                `${p.name} (${p.current_stock})`
              ).join(" · ")}
              {lowStockProducts.length > 4 && ` · +${lowStockProducts.length - 4} more`}
            </span>
          </div>
          <button
            style={{ ...s.btn("outline"), fontSize: 12, padding: "5px 12px" }}
            onClick={() => { setTab("products"); setFilterCat(""); }}
          >
            View All
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={s.tabs}>
        {["products", "purchases"].map(t => (
          <button key={t} style={s.tab(tab === t)} onClick={() => setTab(t)}>
            {t === "products" ? "🗃️ Products" : "🛒 Purchase History"}
          </button>
        ))}
      </div>

      {/* ── Products Tab ── */}
      {tab === "products" && (
        <>
          <div style={s.toolbar}>
            <input
              style={{ ...s.input, width: 240 }}
              placeholder="🔍 Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select style={s.input} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select style={s.input} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
            <span style={{ color: "#6b7280", fontSize: 13, marginLeft: "auto" }}>
              {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""}
            </span>
          </div>

          <table style={s.table}>
            <thead>
              <tr>
                {["Product", "Category", "Cost Price", "Selling Price", "Stock", "Status", "Actions"].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ ...s.td, textAlign: "center", color: "#9ca3af", padding: 40 }}>
                    No products found
                  </td>
                </tr>
              ) : filteredProducts.map(p => {
                const isLow = Number(p.current_stock) <= Number(p.low_stock_threshold);
                return (
                  <tr
                    key={p.id}
                    style={{ transition: "background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                    onMouseLeave={e => e.currentTarget.style.background = ""}
                  >
                    <td style={s.td}>
                      <div style={{ fontWeight: 600, color: "#1a1a2e" }}>{p.name}</div>
                      {p.description && (
                        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{p.description}</div>
                      )}
                    </td>
                    <td style={s.td}><Badge text={p.category} color="blue" /></td>
                    <td style={s.td}>₹{Number(p.cost_price).toLocaleString()}</td>
                    <td style={s.td}>₹{Number(p.selling_price).toLocaleString()}</td>
                    <td style={s.td}>
                      <span style={{ fontWeight: 700, color: isLow ? "#ef4444" : "#059669" }}>
                        {p.current_stock}
                      </span>
                      {isLow && <span style={{ marginLeft: 6 }}>⚠️</span>}
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>
                        threshold: {p.low_stock_threshold}
                      </div>
                    </td>
                    <td style={s.td}>
                      <Badge
                        text={p.is_active ? "Active" : "Inactive"}
                        color={p.is_active ? "green" : "gray"}
                      />
                    </td>
                    <td style={s.td}>
                      <button
                        style={s.iconBtn("#4f46e5")}
                        title="Edit"
                        onClick={() => setProductModal({ open: true, data: p })}
                      >✏️</button>
                      <button
                        style={s.iconBtn("#0891b2")}
                        title="Purchase history"
                        onClick={() => { setHistoryProduct(p); setTab("purchases"); }}
                      >📋</button>
                      {(p.is_active === true || p.is_active === 1) && (
                        <button
                          style={s.iconBtn("#ef4444")}
                          title="Deactivate"
                          onClick={() => handleDeactivate(p.id)}
                        >🚫</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {/* ── Purchases Tab ── */}
      {tab === "purchases" && (
        <>
          <div style={s.toolbar}>
            {historyProduct && (
              <div style={{
                background: "#ede9fe", color: "#5b21b6",
                padding: "6px 14px", borderRadius: 20,
                fontSize: 13, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                📦 {historyProduct.name}
                <button
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#7c3aed", fontSize: 16 }}
                  onClick={() => { setHistoryProduct(null); loadPurchases(""); }}
                >×</button>
              </div>
            )}
            <span style={{ color: "#6b7280", fontSize: 13, marginLeft: "auto" }}>
              {purchases.length} entr{purchases.length !== 1 ? "ies" : "y"}
            </span>
          </div>

          <table style={s.table}>
            <thead>
              <tr>
                {["Date", "Product", "Qty", "Unit Cost", "Total Cost", "Invoice Ref", "Notes", "Added By", "Actions"].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ ...s.td, textAlign: "center", color: "#9ca3af", padding: 40 }}>
                    No purchase entries yet
                  </td>
                </tr>
              ) : purchases.map(pe => (
                <tr
                  key={pe.id}
                  onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                  onMouseLeave={e => e.currentTarget.style.background = ""}
                >
                  <td style={s.td}>{pe.purchase_date}</td>
                  <td style={s.td}>
                    <span style={{ fontWeight: 600 }}>{pe.product_name}</span>
                  </td>
                  <td style={s.td}>{pe.quantity}</td>
                  <td style={s.td}>₹{Number(pe.unit_cost).toLocaleString()}</td>
                  {/* ✅ FIXED: removed duplicate style attribute */}
                  <td style={{ ...s.td, fontWeight: 600, color: "#059669" }}>
                    ₹{Number(pe.total_cost).toLocaleString()}
                  </td>
                  <td style={s.td}>{pe.invoice_ref || <span style={{ color: "#d1d5db" }}>—</span>}</td>
                  <td style={s.td}>{pe.notes       || <span style={{ color: "#d1d5db" }}>—</span>}</td>
                  <td style={s.td}>{pe.created_by_name || "—"}</td>
                  <td style={s.td}>
                    <button
                      style={s.iconBtn("#4f46e5")}
                      title="Edit purchase"
                      onClick={() => setPurchaseModal({ open: true, editData: pe })}
                    >✏️</button>
                    <button
                      style={s.iconBtn("#ef4444")}
                      title="Delete purchase"
                      onClick={() => handleDeletePurchase(pe)}
                    >🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Modals */}
      {productModal.open && (
        <ProductModal
          data={productModal.data}
          categories={categories}
          onSave={handleSaveProduct}
          onClose={() => setProductModal({ open: false, data: null })}
        />
      )}
      {purchaseModal.open && (
        <PurchaseModal
          products={products.filter(p => p.is_active === true || p.is_active === 1)}
          editData={purchaseModal.editData || null}
          onSave={(formData) => handleSavePurchase(formData, purchaseModal.editData?.id || null)}
          onClose={() => setPurchaseModal({ open: false, editData: null })}
        />
      )}

    </div>
  );
}