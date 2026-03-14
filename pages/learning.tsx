import { useState, FormEvent } from 'react';
import { GetServerSideProps } from 'next';
import { supabase } from '../lib/supabaseClient';

interface LearningItem {
  id: number;
  topic: string;
  why: string | null;
  priority: number;
  status: 'pending' | 'in_progress' | 'done' | 'blocked';
  notes: string | null;
  created_at: string;
}

interface Props {
  items: LearningItem[];
  error?: string;
}

// ── Design tokens (matches main dashboard) ─────────────────────────────────
const C = {
  pageBg:    '#0d1526',
  cardBg:    '#17243a',
  itemBg:    '#1c2d42',
  border:    '#263a55',
  borderSub: '#1e3050',
  badgeBg:   '#18283d',
  inputBg:   '#111e30',
  textMain:  '#dde9f8',
  textSec:   '#7a9ab8',
  textMuted: '#4d6a85',
  skeleton:  '#263a55',
};

const STATUS_STYLE: Record<LearningItem['status'], { color: string; bg: string }> = {
  pending:     { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  in_progress: { color: '#60a5fa', bg: 'rgba(96,165,250,0.13)' },
  done:        { color: '#34d399', bg: 'rgba(52,211,153,0.13)' },
  blocked:     { color: '#f87171', bg: 'rgba(248,113,113,0.13)' },
};

const PRIORITY_STYLE: Record<number, { color: string; bg: string; border: string }> = {
  1: { color: '#fca5a5', bg: 'rgba(239,68,68,0.2)',   border: 'rgba(239,68,68,0.4)' },
  2: { color: '#fdba74', bg: 'rgba(249,115,22,0.2)',  border: 'rgba(249,115,22,0.4)' },
  3: { color: '#fde047', bg: 'rgba(234,179,8,0.2)',   border: 'rgba(234,179,8,0.4)' },
  4: { color: '#93c5fd', bg: 'rgba(59,130,246,0.2)',  border: 'rgba(59,130,246,0.4)' },
  5: { color: '#94a3b8', bg: 'rgba(100,116,139,0.2)', border: 'rgba(100,116,139,0.4)' },
};

function pStyle(p: number) {
  const s = PRIORITY_STYLE[p] ?? PRIORITY_STYLE[5];
  return {
    fontSize: 10, fontWeight: 600, borderRadius: 4, padding: '2px 6px',
    color: s.color, background: s.bg, outline: `1px solid ${s.border}`,
    whiteSpace: 'nowrap' as const, flexShrink: 0,
  };
}

function sStyle(status: LearningItem['status']) {
  const s = STATUS_STYLE[status];
  return {
    fontSize: 11, fontWeight: 600, borderRadius: 5, padding: '3px 8px',
    color: s.color, background: s.bg, textTransform: 'uppercase' as const,
    letterSpacing: '0.05em', whiteSpace: 'nowrap' as const, flexShrink: 0,
  };
}

// ── Expandable row ─────────────────────────────────────────────────────────
function LearningRow({ item }: { item: LearningItem }) {
  const [open, setOpen] = useState(false);
  const hasDetails = !!(item.why || item.notes);

  return (
    <div style={{
      background: C.itemBg,
      border: `1px solid ${C.border}`,
      borderRadius: 9,
      overflow: 'hidden',
      transition: 'border-color 0.15s',
    }}>
      {/* Collapsed header — always visible */}
      <button
        onClick={() => hasDetails && setOpen(v => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: 'transparent',
          border: 'none',
          cursor: hasDetails ? 'pointer' : 'default',
          textAlign: 'left',
        }}
      >
        {/* Expand chevron */}
        <span style={{
          fontSize: 10,
          color: hasDetails ? C.textMuted : 'transparent',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          display: 'inline-block',
          flexShrink: 0,
          width: 12,
        }}>▶</span>

        {/* Topic name */}
        <span style={{
          flex: 1,
          fontSize: 14,
          fontWeight: 600,
          color: item.status === 'done' ? C.textMuted : C.textMain,
          textDecoration: item.status === 'done' ? 'line-through' : 'none',
          lineHeight: 1.4,
        }}>
          {item.topic}
        </span>

        {/* Badges row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <span style={pStyle(item.priority)}>P{item.priority}</span>
          <span style={sStyle(item.status)}>{item.status.replace('_', ' ')}</span>
          <span style={{
            fontSize: 11,
            color: C.textMuted,
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            minWidth: 72,
            textAlign: 'right',
          }}>
            {new Date(item.created_at).toLocaleDateString()}
          </span>
        </div>
      </button>

      {/* Expandable details */}
      <div style={{
        maxHeight: open ? 400 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.25s ease',
      }}>
        {hasDetails && (
          <div style={{
            padding: '0 14px 12px 36px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            borderTop: `1px solid ${C.borderSub}`,
            paddingTop: 10,
          }}>
            {item.why && (
              <p style={{ margin: 0, fontSize: 13, color: C.textSec, lineHeight: 1.55 }}>
                {item.why}
              </p>
            )}
            {item.notes && (
              <p style={{ margin: 0, fontSize: 12, color: C.textMuted, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {item.notes}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function LearningPage({ items, error }: Props) {
  const [localItems, setLocalItems] = useState<LearningItem[]>(items);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [topic, setTopic] = useState('');
  const [why, setWhy] = useState('');
  const [priority, setPriority] = useState<number>(3);
  const [status, setStatus] = useState<LearningItem['status']>('pending');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  if (error) {
    return (
      <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '12px 16px', fontSize: 14, color: '#fca5a5' }}>
        {error}
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!supabase) { setFormError('Supabase client not configured.'); return; }
    if (!topic.trim()) { setFormError('Topic is required'); return; }
    setFormLoading(true);
    try {
      const { data, error: insertError } = await supabase
        .from('agent_learning_backlog')
        .insert({
          topic: topic.trim(),
          why: why.trim() || null,
          priority: Number(priority) || 3,
          status,
          notes: notes.trim() || null,
        })
        .select()
        .single();

      if (insertError) {
        setFormError(insertError.message);
      } else if (data) {
        setLocalItems(prev =>
          [...prev, data].sort((a, b) =>
            a.priority !== b.priority
              ? a.priority - b.priority
              : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        );
        setTopic(''); setWhy(''); setPriority(3); setStatus('pending'); setNotes('');
        setShowForm(false);
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setFormLoading(false);
    }
  };

  const learned = localItems.filter(i => i.status === 'done').length;
  const pending = localItems.filter(i => i.status !== 'done').length;

  const labelSt = {
    display: 'block' as const,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: C.textMuted,
    marginBottom: 5,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontFamily: "var(--font-inter, 'Inter', system-ui, sans-serif)", color: C.textMain }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.textMain, letterSpacing: '-0.02em' }}>
            📚 Learning Backlog
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textSec }}>
            Topics Boban should study next.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setFormError(null); }}
          style={{
            background: showForm ? 'transparent' : '#5b5ef4',
            color: showForm ? C.textSec : '#fff',
            border: showForm ? `1px solid ${C.border}` : 'none',
            padding: '8px 16px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {showForm ? 'Cancel' : '+ Add topic'}
        </button>
      </div>

      {/* Summary bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: '12px 16px',
      }}>
        <span style={{ fontSize: 13, color: C.textMain, fontWeight: 500 }}>
          <span style={{ color: '#34d399', fontWeight: 700 }}>{learned}</span> learned
        </span>
        <span style={{ color: C.borderSub, fontSize: 14 }}>·</span>
        <span style={{ fontSize: 13, color: C.textMain, fontWeight: 500 }}>
          <span style={{ color: '#7a9ab8', fontWeight: 700 }}>{pending}</span> pending
        </span>
        {localItems.length > 0 && (
          <>
            <span style={{ color: C.borderSub, fontSize: 14 }}>·</span>
            <span style={{ fontSize: 12, color: C.textMuted }}>
              {Math.round((learned / localItems.length) * 100)}% complete
            </span>
            {/* Mini progress bar */}
            <div style={{ flex: 1, maxWidth: 120, height: 4, background: C.borderSub, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.round((learned / localItems.length) * 100)}%`,
                background: 'linear-gradient(90deg, #22c55e, #34d399)',
                borderRadius: 999,
                transition: 'width 0.4s ease',
              }} />
            </div>
          </>
        )}
      </div>

      {/* Add form — collapsible */}
      <div style={{
        maxHeight: showForm ? 600 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.3s ease',
      }}>
        <form
          onSubmit={handleSubmit}
          style={{
            background: C.cardBg,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelSt}>Topic *</label>
              <input
                className="input-dark"
                placeholder="e.g. Supabase Row Level Security"
                value={topic}
                onChange={e => setTopic(e.target.value)}
              />
            </div>
            <div>
              <label style={labelSt}>Priority (1 = highest)</label>
              <input
                type="number" min={1} max={9}
                className="input-dark"
                value={priority}
                onChange={e => setPriority(Number(e.target.value) || 3)}
              />
            </div>
          </div>

          <div>
            <label style={labelSt}>Why this matters</label>
            <textarea
              className="input-dark"
              placeholder="Context, project, or risk that makes this worth learning."
              value={why}
              onChange={e => setWhy(e.target.value)}
              style={{ minHeight: 60, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelSt}>Status</label>
              <select
                className="input-dark"
                value={status}
                onChange={e => setStatus(e.target.value as LearningItem['status'])}
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div>
              <label style={labelSt}>Notes</label>
              <textarea
                className="input-dark"
                placeholder="Links, example repos, constraints..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                style={{ minHeight: 60, resize: 'vertical' }}
              />
            </div>
          </div>

          {formError && <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>{formError}</p>}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={formLoading}
              style={{
                background: '#5b5ef4',
                color: '#fff',
                border: 'none',
                padding: '8px 18px',
                borderRadius: 6,
                cursor: formLoading ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 500,
                opacity: formLoading ? 0.7 : 1,
              }}
            >
              {formLoading ? 'Saving…' : 'Add topic'}
            </button>
          </div>
        </form>
      </div>

      {/* Items list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {localItems.length === 0 && (
          <p style={{ fontSize: 14, color: C.textMuted, margin: 0 }}>No learning items yet.</p>
        )}
        {localItems.map(item => (
          <LearningRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  if (!supabase) {
    return {
      props: {
        items: [],
        error: 'Supabase client not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      },
    };
  }

  const { data, error } = await supabase
    .from('agent_learning_backlog')
    .select('*')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    return { props: { items: [], error: error.message } };
  }

  return { props: { items: data ?? [] } };
};
