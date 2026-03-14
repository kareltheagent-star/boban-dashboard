import { useState } from "react";
import { GetServerSideProps } from "next";
import { createClient } from "@supabase/supabase-js";
import { useBreakpoint } from "../hooks/useBreakpoint";

type Status = "pending" | "in_progress" | "blocked" | "done";

interface BacklogItem {
  id: string;
  title: string;
  description?: string;
  priority: number;
  status: Status;
  created_by?: string;
  tags?: string[];
  notes?: string;
  created_at: string;
}

interface Props {
  initialItems: BacklogItem[];
}

const COLUMNS: { key: Status; label: string; color: string; dot: string }[] = [
  { key: "pending",     label: "Pending",     color: "border-slate-600",  dot: "bg-slate-400" },
  { key: "in_progress", label: "In Progress", color: "border-blue-500",   dot: "bg-blue-400" },
  { key: "blocked",     label: "Blocked",     color: "border-red-500",    dot: "bg-red-400" },
  { key: "done",        label: "Done",        color: "border-emerald-500",dot: "bg-emerald-400" },
];

const PRIORITY_COLORS: Record<number, string> = {
  1: "bg-red-500/20 text-red-300 ring-1 ring-red-500/40",
  2: "bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/40",
  3: "bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/40",
  4: "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40",
  5: "bg-slate-500/20 text-slate-400 ring-1 ring-slate-500/40",
};

export default function BacklogPage({ initialItems }: Props) {
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";
  const isTablet  = bp === "tablet";

  const [items, setItems] = useState<BacklogItem[]>(initialItems);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Status | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<BacklogItem | null>(null);
  const [form, setForm] = useState({ title: "", description: "", priority: 3, status: "pending" as Status, tags: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const byStatus = (status: Status) =>
    items.filter(i => i.status === status).sort((a, b) => a.priority - b.priority);

  const handleDragStart = (id: string) => setDragging(id);
  const handleDragEnd = () => { setDragging(null); setDragOver(null); };

  const handleDrop = async (status: Status) => {
    if (!dragging) return;
    setDragOver(null);
    const item = items.find(i => i.id === dragging);
    if (!item || item.status === status) return;
    setItems(prev => prev.map(i => i.id === dragging ? { ...i, status } : i));
    await supabase.from("agent_backlog").update({ status }).eq("id", dragging);
    setDragging(null);
  };

  const openEdit = (item: BacklogItem) => {
    setEditItem(item);
    setForm({
      title: item.title,
      description: item.description || "",
      priority: item.priority,
      status: item.status,
      tags: (item.tags || []).join(", "),
      notes: item.notes || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = {
      title: form.title,
      description: form.description,
      priority: form.priority,
      status: form.status,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      notes: form.notes,
    };
    if (editItem) {
      await supabase.from("agent_backlog").update(payload).eq("id", editItem.id);
      setItems(prev => prev.map(i => i.id === editItem.id ? { ...i, ...payload } : i));
    } else {
      const { data } = await supabase.from("agent_backlog").insert({ ...payload, created_by: "human" }).select().single();
      if (data) setItems(prev => [...prev, data]);
    }
    setSaving(false);
    setShowForm(false);
    setEditItem(null);
    setForm({ title: "", description: "", priority: 3, status: "pending", tags: "", notes: "" });
  };

  const handleDelete = async (id: string) => {
    await supabase.from("agent_backlog").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
    setShowForm(false);
    setEditItem(null);
  };

  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&family=Inter:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
        .card-drag { cursor: grab; transition: all 0.15s ease; }
        .card-drag:active { cursor: grabbing; transform: rotate(1deg) scale(1.02); }
        .card-drag:hover { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
        .col-drop-active { background: rgba(99,102,241,0.05); border-color: rgba(99,102,241,0.4) !important; }
        .input-dark { background: #0f172a; border: 1px solid #1e293b; color: #e2e8f0; padding: 8px 12px; border-radius: 6px; width: 100%; font-family: inherit; font-size: 13px; outline: none; transition: border-color 0.15s; }
        .input-dark:focus { border-color: #6366f1; }
        .input-dark::placeholder { color: #475569; }
        .btn-primary { background: #6366f1; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; transition: all 0.15s; }
        .btn-primary:hover { background: #4f46e5; }
        .btn-ghost { background: transparent; color: #64748b; border: 1px solid #1e293b; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-family: inherit; font-size: 12px; transition: all 0.15s; }
        .btn-ghost:hover { color: #e2e8f0; border-color: #334155; }
        .btn-danger { background: transparent; color: #f87171; border: 1px solid #1e293b; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-family: inherit; font-size: 11px; transition: all 0.15s; }
        .btn-danger:hover { background: rgba(239,68,68,0.1); border-color: #ef4444; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 50; display: flex; align-items: center; justify-content: center; padding: 16px; }
        .modal { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 24px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; }
        select.input-dark option { background: #0f172a; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#e2e8f0", letterSpacing: "-0.02em" }}>
            Agent Backlog
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#475569" }}>
            {items.length} tasks · drag to move between columns
          </p>
        </div>
        <button className="btn-primary" onClick={() => { setEditItem(null); setForm({ title: "", description: "", priority: 3, status: "pending", tags: "", notes: "" }); setShowForm(true); }}>
          + New Task
        </button>
      </div>

      {/* Kanban Board */}
      <div
        className={isMobile ? "kanban-scroll" : ""}
        style={isMobile ? {} : isTablet
          ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }
          : { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, alignItems: "start" }}
      >
        {COLUMNS.map(col => {
          const colItems = byStatus(col.key);
          return (
            <div
              key={col.key}
              className={[dragOver === col.key ? "col-drop-active" : "", isMobile ? "kanban-col-snap" : ""].join(" ").trim()}
              onDragOver={e => { e.preventDefault(); setDragOver(col.key); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(col.key)}
              style={{
                background: "#0b1120",
                border: `1px solid`,
                borderColor: dragOver === col.key ? "rgba(99,102,241,0.4)" : "#1e293b",
                borderRadius: 10,
                padding: 12,
                minHeight: 200,
                transition: "all 0.15s",
              }}
            >
              {/* Column Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span className={col.dot} style={{ width: 7, height: 7, borderRadius: "50%", display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {col.label}
                </span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#334155", background: "#1e293b", borderRadius: 10, padding: "1px 7px" }}>
                  {colItems.length}
                </span>
              </div>

              {/* Cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {colItems.length === 0 && (
                  <div style={{ textAlign: "center", padding: "20px 0", color: "#1e293b", fontSize: 12 }}>
                    drop here
                  </div>
                )}
                {colItems.map(item => (
                  <div
                    key={item.id}
                    className="card-drag"
                    draggable
                    onDragStart={() => handleDragStart(item.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => openEdit(item)}
                    style={{
                      background: dragging === item.id ? "#1e293b" : "#111827",
                      border: "1px solid #1e293b",
                      borderRadius: 8,
                      padding: "10px 12px",
                      opacity: dragging === item.id ? 0.5 : 1,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#e2e8f0", lineHeight: 1.4, fontFamily: "'Inter', sans-serif" }}>
                        {item.title}
                      </span>
                      <span className={PRIORITY_COLORS[item.priority] || PRIORITY_COLORS[5]} style={{ fontSize: 10, fontWeight: 600, borderRadius: 4, padding: "2px 6px", flexShrink: 0 }}>
                        P{item.priority}
                      </span>
                    </div>
                    {item.description && (
                      <p style={{ margin: "0 0 8px", fontSize: 11, color: "#475569", lineHeight: 1.5, fontFamily: "'Inter', sans-serif" }}>
                        {item.description.slice(0, 80)}{item.description.length > 80 ? "…" : ""}
                      </p>
                    )}
                    {item.tags && item.tags.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                        {item.tags.map(tag => (
                          <span key={tag} style={{ fontSize: 10, color: "#6366f1", background: "rgba(99,102,241,0.1)", borderRadius: 4, padding: "1px 6px", border: "1px solid rgba(99,102,241,0.2)" }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: "#334155", display: "flex", justifyContent: "space-between" }}>
                      <span>{item.created_by || "system"}</span>
                      <span>{new Date(item.created_at).toLocaleDateString("cs-CZ")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowForm(false); setEditItem(null); }}}>
          <div className="modal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>
                {editItem ? "Edit Task" : "New Task"}
              </h2>
              <button className="btn-ghost" onClick={() => { setShowForm(false); setEditItem(null); }} style={{ padding: "4px 10px" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>TITLE *</label>
                <input className="input-dark" placeholder="Task title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="form-grid-2">
                <div>
                  <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>PRIORITY</label>
                  <select className="input-dark" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: +e.target.value }))}>
                    {[1,2,3,4,5].map(p => <option key={p} value={p}>P{p} {p===1?"(highest)":p===5?"(lowest)":""}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>STATUS</label>
                  <select className="input-dark" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))}>
                    {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>DESCRIPTION</label>
                <textarea className="input-dark" placeholder="Details, acceptance criteria..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ minHeight: 80, resize: "vertical" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>TAGS</label>
                <input className="input-dark" placeholder="infra, dashboard, api" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>NOTES</label>
                <textarea className="input-dark" placeholder="Additional notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ minHeight: 60, resize: "vertical" }} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
              <div>
                {editItem && <button className="btn-danger" onClick={() => handleDelete(editItem.id)}>Delete</button>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-ghost" onClick={() => { setShowForm(false); setEditItem(null); }}>Cancel</button>
                <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
                  {saving ? "Saving..." : editItem ? "Save changes" : "Add task"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase
    .from("agent_backlog")
    .select("*")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false });
  return { props: { initialItems: data || [] } };
};
