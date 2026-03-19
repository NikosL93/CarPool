import { useState, useEffect, useCallback } from "react";

const SUPABASE_URL = "https://admmtwvgsisczfxuancp.supabase.co";
const SUPABASE_KEY = "sb_publishable_jiDARJ5ElXvN9EPMQDUpmA_m5uXkZX_";

const MEMBERS = ["Νίκος", "Γιώργος", "Μάνος"];

const headers = {
  "Content-Type": "application/json",
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

async function dbGet(table, params = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function dbPost(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function dbDelete(table, id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error(await res.text());
}

const TRIP_TYPES = [
  { id: "round", label: "Κανονική", icon: "⇄", desc: "Πήγαινε-Έλα" },
  { id: "one", label: "Μονή", icon: "→", desc: "Μόνο πήγαινε" },
];

function groupKey(members) {
  return [...members].sort().join("+");
}

function scoresForGroup(key, trips) {
  const scores = {};
  key.split("+").forEach((m) => (scores[m] = 0));
  trips
    .filter((t) => t.present_key === key)
    .forEach((t) => {
      const pts = t.type === "round" ? 1 : 0.5;
      if (scores[t.driver] !== undefined) scores[t.driver] += pts;
    });
  return scores;
}

const COLORS = { Νίκος: "#3b82f6", Γιώργος: "#8b5cf6", Μάνος: "#10b981" };

export default function App() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("home");
  const [tripType, setTripType] = useState("round");
  const [present, setPresent] = useState({ Νίκος: true, Γιώργος: true, Μάνος: true });
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const t = await dbGet("trips", "order=created_at.desc&limit=300");
      t.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setTrips(t);
    } catch (e) {
      showToast("❌ Σφάλμα: " + e.message, "#ef4444");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  function showToast(msg, color = "#22c55e") {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3000);
  }

  const presentMembers = MEMBERS.filter((m) => present[m]);
  const currentKey = groupKey(presentMembers);
  const currentScores = presentMembers.length > 0 ? scoresForGroup(currentKey, trips) : {};
  const rankedPresent = [...presentMembers].sort((a, b) => (currentScores[a] ?? 0) - (currentScores[b] ?? 0));
  const nextDriver = rankedPresent[0];
  const maxScore = Math.max(1, ...rankedPresent.map((m) => currentScores[m] ?? 0));

  async function logTrip() {
    if (!selectedDriver || saving || presentMembers.length === 0) return;
    setSaving(true);
    try {
      const now = new Date();
      const [created] = await dbPost("trips", {
        driver: selectedDriver,
        type: tripType,
        date: now.toLocaleDateString("el-GR"),
        time: now.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" }),
        present_key: currentKey,
      });
      setTrips((prev) => [created, ...prev]);
      showToast(`✓ ${selectedDriver} οδήγησε`);
      setSelectedDriver(null);
    } catch (e) {
      showToast("❌ " + e.message, "#ef4444");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTrip(id) {
    try {
      await dbDelete("trips", id);
      setTrips((prev) => prev.filter((t) => t.id !== id));
      setConfirmDelete(null);
      showToast("Διαγράφηκε", "#ef4444");
    } catch (e) {
      showToast("❌ " + e.message, "#ef4444");
    }
  }

  const allKeys = [...new Set(trips.map((t) => t.present_key).filter(Boolean))];

  if (loading)
    return (
      <div style={S.loadingScreen}>
        <div style={S.spinner} />
        <p style={S.loadingText}>Σύνδεση στη βάση...</p>
      </div>
    );

  return (
    <div style={S.root}>
      <div style={S.bgPattern} />
      {toast && <div style={{ ...S.toast, background: toast.color }}>{toast.msg}</div>}
      {confirmDelete && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <p style={S.modalText}>Διαγραφή καταχώρησης;</p>
            <div style={S.modalBtns}>
              <button style={S.btnCancel} onClick={() => setConfirmDelete(null)}>Άκυρο</button>
              <button style={S.btnDanger} onClick={() => deleteTrip(confirmDelete)}>Διαγραφή</button>
            </div>
          </div>
        </div>
      )}

      <header style={S.header}>
        <div style={S.logo}>🚗</div>
        <h1 style={S.title}>CarPool</h1>
        <p style={S.subtitle}>Νίκος · Γιώργος · Μάνος</p>
        <button style={S.refreshBtn} onClick={load}>↻</button>
      </header>

      <nav style={S.tabs}>
        {[["home", "🏠 Αρχική"], ["history", "📋 Ιστορικό"], ["stats", "📊 Σκορ"]].map(([id, label]) => (
          <button key={id} style={{ ...S.tab, ...(tab === id ? S.tabActive : {}) }} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      <main style={S.main}>

        {/* ── HOME ── */}
        {tab === "home" && (
          <div>
            <div style={S.sectionLabel}>Ποιοι είναι σήμερα;</div>
            <div style={S.presenceRow}>
              {MEMBERS.map((m) => (
                <button
                  key={m}
                  style={{
                    ...S.presenceBtn,
                    background: present[m] ? COLORS[m] + "18" : "#111827",
                    border: `1px solid ${present[m] ? COLORS[m] + "66" : "#1f2937"}`,
                  }}
                  onClick={() => { setPresent((p) => ({ ...p, [m]: !p[m] })); setSelectedDriver(null); }}
                >
                  <div style={{
                    ...S.avatar,
                    background: present[m] ? COLORS[m] + "30" : "#1f2937",
                    color: present[m] ? COLORS[m] : "#4b5563",
                    border: `2px solid ${present[m] ? COLORS[m] : "#374151"}`,
                  }}>{m[0]}</div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: present[m] ? "#e8eaf0" : "#4b5563" }}>{m}</span>
                  <span style={{ fontSize: 12, color: present[m] ? "#22c55e" : "#374151" }}>{present[m] ? "✓" : "—"}</span>
                </button>
              ))}
            </div>

            {presentMembers.length === 0 ? (
              <div style={S.emptyCard}>Επίλεξε τουλάχιστον έναν ☝️</div>
            ) : (
              <div style={S.nextCard}>
                {/* Group label */}
                <div style={{ fontSize: 13, marginBottom: 6 }}>
                  {rankedPresent.map((m, i) => (
                    <span key={m}>
                      <span style={{ color: COLORS[m], fontWeight: 700 }}>{m}</span>
                      {i < rankedPresent.length - 1 && <span style={{ color: "#374151" }}> & </span>}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#4b5563", marginBottom: 4 }}>ΣΕΙΡΑ ΤΩΡΑ</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: "#fff", marginBottom: 2 }}>{nextDriver}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
                  {(currentScores[nextDriver] ?? 0).toFixed(1)} pts σε αυτή την ομάδα
                </div>
                {/* Mini bar chart */}
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {rankedPresent.map((m) => (
                    <div key={m} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 60, fontSize: 12, fontWeight: 600, color: COLORS[m] }}>{m}</span>
                      <div style={{ flex: 1, height: 6, background: "#1f2937", borderRadius: 100, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 100,
                          width: `${Math.max(4, ((currentScores[m] ?? 0) / maxScore) * 100)}%`,
                          background: COLORS[m], transition: "width 0.4s",
                        }} />
                      </div>
                      <span style={{ fontSize: 11, color: "#6b7280", width: 28, textAlign: "right" }}>
                        {(currentScores[m] ?? 0).toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ ...S.sectionLabel, marginTop: 20 }}>Τύπος διαδρομής</div>
            <div style={S.tripTypes}>
              {TRIP_TYPES.map((t) => (
                <button key={t.id} style={{ ...S.tripBtn, ...(tripType === t.id ? S.tripBtnActive : {}) }} onClick={() => setTripType(t.id)}>
                  <span style={{ fontSize: 22 }}>{t.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{t.label}</span>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>{t.desc}</span>
                </button>
              ))}
            </div>

            {presentMembers.length > 0 && (
              <>
                <div style={S.sectionLabel}>Ποιος οδήγησε;</div>
                <div style={S.driverGrid}>
                  {rankedPresent.map((m, i) => (
                    <button
                      key={m}
                      style={{
                        ...S.driverBtn,
                        borderColor: selectedDriver === m ? COLORS[m] : i === 0 ? "#22c55e44" : "#1f2937",
                        background: selectedDriver === m ? COLORS[m] + "18" : "#161b27",
                      }}
                      onClick={() => setSelectedDriver(m === selectedDriver ? null : m)}
                    >
                      <div style={{
                        ...S.avatar, width: 32, height: 32, fontSize: 14,
                        background: COLORS[m] + "22", color: COLORS[m], border: `2px solid ${COLORS[m]}44`,
                      }}>{m[0]}</div>
                      <span style={S.driverName}>{m}</span>
                      {i === 0 && <span style={S.turnBadge}>σειρά</span>}
                      <span style={{ fontSize: 12, color: "#6b7280" }}>{(currentScores[m] ?? 0).toFixed(1)} pts</span>
                    </button>
                  ))}
                </div>
                <button
                  style={{ ...S.logBtn, ...(!selectedDriver || saving ? S.logBtnDisabled : {}) }}
                  disabled={!selectedDriver || saving}
                  onClick={logTrip}
                >
                  {saving ? "Αποθήκευση..." : "✓ Καταχώρηση"}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab === "history" && (
          <div>
            <div style={S.sectionLabel}>{trips.length} καταχωρήσεις</div>
            {trips.length === 0 ? <div style={S.empty}>Καμία καταχώρηση ακόμα</div> : trips.map((h) => {
              const members = (h.present_key || "").split("+");
              return (
                <div key={h.id} style={S.historyItem}>
                  <div style={S.historyLeft}>
                    <span style={{ fontSize: 20, width: 28, textAlign: "center", paddingTop: 2 }}>
                      {h.type === "round" ? "⇄" : "→"}
                    </span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: COLORS[h.driver] || "#e8eaf0", marginBottom: 2 }}>
                        {h.driver}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 3 }}>
                        {h.date} · {h.time} · {h.type === "round" ? "Κανονική" : "Μονή"}
                      </div>
                      <div style={{ fontSize: 11 }}>
                        {members.map((m, i) => (
                          <span key={m}>
                            <span style={{ color: COLORS[m] || "#6b7280", fontWeight: 600 }}>{m}</span>
                            {i < members.length - 1 && <span style={{ color: "#374151" }}> & </span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button style={S.deleteBtn} onClick={() => setConfirmDelete(h.id)}>✕</button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── STATS ── */}
        {tab === "stats" && (
          <div>
            {allKeys.length === 0 && <div style={S.empty}>Καμία καταχώρηση ακόμα</div>}
            {allKeys
              .sort((a, b) => b.split("+").length - a.split("+").length)
              .map((key) => {
                const scores = scoresForGroup(key, trips);
                const members = key.split("+");
                const ranked = [...members].sort((a, b) => scores[a] - scores[b]);
                const total = trips.filter((t) => t.present_key === key).length;
                const maxS = Math.max(1, ...members.map((m) => scores[m]));
                return (
                  <div key={key} style={S.statGroup}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>
                        {members.map((m, i) => (
                          <span key={m}>
                            <span style={{ color: COLORS[m] }}>{m}</span>
                            {i < members.length - 1 && <span style={{ color: "#374151" }}> & </span>}
                          </span>
                        ))}
                      </span>
                      <span style={{ fontSize: 11, color: "#4b5563", fontWeight: 400 }}>{total} διαδρομές</span>
                    </div>
                    {ranked.map((m, i) => (
                      <div key={m} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 16, width: 28, textAlign: "center" }}>{i === 0 ? "🚗" : `#${i + 1}`}</span>
                        <span style={{ width: 68, fontWeight: 600, fontSize: 13, color: COLORS[m] }}>{m}</span>
                        <div style={{ flex: 1, height: 7, background: "#1f2937", borderRadius: 100, overflow: "hidden" }}>
                          <div style={{
                            height: "100%", borderRadius: 100, minWidth: 4,
                            width: `${(scores[m] / maxS) * 100}%`,
                            background: COLORS[m], opacity: i === 0 ? 1 : 0.4,
                            transition: "width 0.5s",
                          }} />
                        </div>
                        <span style={{ width: 32, textAlign: "right", fontSize: 13, color: "#9ca3af", fontWeight: 700 }}>
                          {scores[m].toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
          </div>
        )}
      </main>
    </div>
  );
}

const S = {
  root: { minHeight: "100vh", background: "#0f1117", color: "#e8eaf0", fontFamily: "'Segoe UI', system-ui, sans-serif", position: "relative" },
  bgPattern: { position: "fixed", inset: 0, backgroundImage: `radial-gradient(circle at 20% 20%, #1e3a5f22 0%, transparent 50%), radial-gradient(circle at 80% 80%, #2d1b4e22 0%, transparent 50%)`, pointerEvents: "none" },
  loadingScreen: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0f1117", gap: 16 },
  spinner: { width: 40, height: 40, border: "3px solid #1f2937", borderTop: "3px solid #3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  loadingText: { color: "#6b7280", fontSize: 14 },
  header: { textAlign: "center", padding: "32px 16px 16px", position: "relative" },
  logo: { fontSize: 48, lineHeight: 1 },
  title: { margin: "8px 0 4px", fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", background: "linear-gradient(135deg, #60a5fa, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  subtitle: { margin: 0, color: "#6b7280", fontSize: 13 },
  refreshBtn: { position: "absolute", top: 32, right: 16, background: "#161b27", border: "1px solid #1f2937", color: "#6b7280", borderRadius: 10, padding: "6px 12px", cursor: "pointer", fontSize: 18 },
  tabs: { display: "flex", gap: 4, padding: "0 16px 16px", maxWidth: 480, margin: "0 auto" },
  tab: { flex: 1, padding: "10px 4px", border: "1px solid #1f2937", borderRadius: 10, background: "#161b27", color: "#6b7280", cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.2s" },
  tabActive: { background: "linear-gradient(135deg, #1e40af, #5b21b6)", color: "#fff", borderColor: "transparent" },
  main: { maxWidth: 480, margin: "0 auto", padding: "0 16px 40px" },
  sectionLabel: { fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "#4b5563", marginBottom: 10, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 },
  presenceRow: { display: "flex", gap: 8, marginBottom: 20 },
  presenceBtn: { flex: 1, padding: "12px 8px", borderRadius: 14, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, transition: "all 0.2s" },
  avatar: { width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, transition: "all 0.2s" },
  emptyCard: { background: "#161b27", borderRadius: 20, padding: "28px 20px", textAlign: "center", color: "#4b5563", fontSize: 15, marginBottom: 20, border: "1px solid #1f2937" },
  nextCard: { background: "linear-gradient(145deg, #111827, #1a1f2e)", borderRadius: 20, padding: "20px 20px 18px", marginBottom: 4, border: "1px solid #2d3748", boxShadow: "0 8px 32px #0008" },
  tripTypes: { display: "flex", gap: 10, marginBottom: 20 },
  tripBtn: { flex: 1, padding: "14px 10px", border: "1px solid #1f2937", borderRadius: 14, background: "#161b27", color: "#6b7280", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, transition: "all 0.2s" },
  tripBtnActive: { border: "1px solid #3b82f6", background: "#1e3a5f", color: "#60a5fa" },
  driverGrid: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 },
  driverBtn: { display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", border: "1px solid #1f2937", borderRadius: 14, background: "#161b27", color: "#d1d5db", cursor: "pointer", textAlign: "left", transition: "all 0.15s" },
  driverName: { flex: 1, fontWeight: 600, fontSize: 16 },
  turnBadge: { fontSize: 10, color: "#22c55e", background: "#064e3b33", padding: "2px 8px", borderRadius: 100, fontWeight: 700 },
  logBtn: { width: "100%", padding: "16px", border: "none", borderRadius: 16, background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5, boxShadow: "0 4px 20px #2563eb44", transition: "opacity 0.2s" },
  logBtnDisabled: { opacity: 0.3, cursor: "not-allowed" },
  historyItem: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "14px 16px", background: "#161b27", borderRadius: 14, marginBottom: 8, border: "1px solid #1f2937" },
  historyLeft: { display: "flex", alignItems: "flex-start", gap: 12 },
  deleteBtn: { background: "none", border: "none", color: "#374151", cursor: "pointer", fontSize: 14, padding: "4px 8px", borderRadius: 8, flexShrink: 0 },
  statGroup: { background: "#161b27", borderRadius: 16, padding: "16px", marginBottom: 14, border: "1px solid #1f2937" },
  empty: { textAlign: "center", color: "#4b5563", padding: "40px 20px", fontSize: 14 },
  toast: { position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", padding: "12px 24px", borderRadius: 100, color: "#fff", fontWeight: 600, fontSize: 14, zIndex: 999, boxShadow: "0 4px 20px #0008", whiteSpace: "nowrap" },
  overlay: { position: "fixed", inset: 0, background: "#000a", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modal: { background: "#1a1f2e", borderRadius: 20, padding: "28px 24px", border: "1px solid #2d3748", minWidth: 280 },
  modalText: { textAlign: "center", fontSize: 16, fontWeight: 600, margin: "0 0 20px" },
  modalBtns: { display: "flex", gap: 10 },
  btnCancel: { flex: 1, padding: "12px", border: "1px solid #374151", borderRadius: 12, background: "none", color: "#9ca3af", cursor: "pointer", fontWeight: 600 },
  btnDanger: { flex: 1, padding: "12px", border: "none", borderRadius: 12, background: "#dc2626", color: "#fff", cursor: "pointer", fontWeight: 700 },
};
