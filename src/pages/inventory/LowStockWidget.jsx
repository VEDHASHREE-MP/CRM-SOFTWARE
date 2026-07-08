import { useState, useEffect } from 'react';

const API = "http://localhost:5000/api/inventory";
const getToken = () => localStorage.getItem("vtcrm_token");

function LowStockWidget({ stats: propStats }) {
  const [stats, setStats] = useState(propStats ?? null);

  useEffect(() => {
    if (propStats !== undefined) {
      setStats(propStats);
      return;
    }
    // Self-fetch mode: when used standalone without passing stats as a prop
    fetch(`${API}/stats/summary`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(setStats)
      .catch(console.error);
  }, [propStats]);
  if (!stats || stats.low_stock_count === 0) return null;

  return (

    <div style={{
      background: "#fff",
      border: "1px solid #e8eaed",
      borderRadius: 12,
      padding: "20px 24px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      {/* Widget Header */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#1a1a2e" }}>
            Low Stock Alert
          </span>
          <span style={{
            background: "#fee2e2", color: "#991b1b",
            borderRadius: 20, padding: "2px 10px",
            fontSize: 12, fontWeight: 700,
          }}>
            {stats.low_stock_count} item{stats.low_stock_count !== 1 ? "s" : ""}
          </span>
        </div>
        <a href="/inventory" style={{
          fontSize: 13, color: "#4f46e5", fontWeight: 600,
          textDecoration: "none",
        }}>
          View Inventory →
        </a>
      </div>

      {/* Low Stock Items List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {stats.low_stock_items.map(item => {
          const pct = item.low_stock_threshold > 0
            ? Math.min((Number(item.current_stock) / Number(item.low_stock_threshold)) * 100, 100)
            : 0;
          const isOut = Number(item.current_stock) === 0;

          return (
            <div key={item.id} style={{
              display: "flex", alignItems: "center", gap: 12,
            }}>
              {/* Icon */}
              <span style={{ fontSize: 16, flexShrink: 0 }}>
                {isOut ? "🚫" : "📉"}
              </span>

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: "#1a1a2e",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {item.name}
                </div>

                {/* Progress bar */}
                <div style={{
                  height: 4, background: "#f3f4f6", borderRadius: 4,
                  marginTop: 4, overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%", borderRadius: 4,
                    width: `${pct}%`,
                    background: isOut ? "#ef4444" : "#f59e0b",
                    transition: "width 0.3s",
                  }} />
                </div>
              </div>

              {/* Stock count */}
              <div style={{
                fontSize: 13, fontWeight: 700, flexShrink: 0,
                color: isOut ? "#ef4444" : "#d97706",
              }}>
                {item.current_stock} / {item.low_stock_threshold}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note if more items */}
      {stats.low_stock_count > 5 && (
        <div style={{
          marginTop: 12, paddingTop: 12,
          borderTop: "1px solid #f3f4f6",
          fontSize: 12, color: "#6b7280", textAlign: "center",
        }}>
          +{stats.low_stock_count - 5} more items need attention
        </div>
      )}
    </div>
  );
}

export default LowStockWidget;