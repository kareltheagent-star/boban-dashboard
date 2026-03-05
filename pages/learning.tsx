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

export default function LearningPage({ items, error }: Props) {
  const [localItems, setLocalItems] = useState<LearningItem[]>(items);
  const [topic, setTopic] = useState('');
  const [why, setWhy] = useState('');
  const [priority, setPriority] = useState<number>(3);
  const [status, setStatus] = useState<LearningItem['status']>('pending');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  if (error) {
    return <p className="text-red-400 text-sm">{error}</p>;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!supabase) {
      setFormError('Supabase client not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }

    if (!topic.trim()) {
      setFormError('Topic is required');
      return;
    }

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
        setLocalItems((prev) =>
          [...prev, data].sort((a, b) => {
            if (a.priority === b.priority) {
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }
            return a.priority - b.priority;
          })
        );
        setTopic('');
        setWhy('');
        setPriority(3);
        setStatus('pending');
        setNotes('');
      }
    } catch (err: any) {
      setFormError(err.message ?? 'Unknown error while saving learning item');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Learning backlog</h1>
        <p className="text-slate-400 text-sm">
          Topics Boban should study next. Add new items as you notice gaps, then we can schedule work from here.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-slate-800 p-3">
        <h2 className="text-sm font-medium">Add learning topic</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Topic</label>
            <input
              className="w-full rounded bg-slate-950 border border-slate-800 px-2 py-1 text-sm"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Supabase Row Level Security"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Priority (1 = highest)</label>
            <input
              type="number"
              min={1}
              max={9}
              className="w-full rounded bg-slate-950 border border-slate-800 px-2 py-1 text-sm"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) || 3)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-400">Why this matters</label>
          <textarea
            className="w-full rounded bg-slate-950 border border-slate-800 px-2 py-1 text-sm min-h-[60px]"
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            placeholder="Context, project, or risk that makes this worth learning."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Status</label>
            <select
              className="w-full rounded bg-slate-950 border border-slate-800 px-2 py-1 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as LearningItem['status'])}
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Notes</label>
            <textarea
              className="w-full rounded bg-slate-950 border border-slate-800 px-2 py-1 text-sm min-h-[60px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Links, example repos, constraints..."
            />
          </div>
        </div>

        {formError && <p className="text-xs text-red-400">{formError}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="submit"
            disabled={formLoading}
            className="px-3 py-1 rounded bg-slate-100 text-slate-900 text-xs font-medium hover:bg-white disabled:opacity-60"
          >
            {formLoading ? 'Saving...' : 'Add topic'}
          </button>
        </div>
      </form>

      <div className="space-y-2">
        <h2 className="text-sm font-medium">Existing items</h2>
        {localItems.length === 0 && (
          <p className="text-slate-500 text-sm">No learning items yet.</p>
        )}
        {localItems.map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-800 p-3 flex flex-col gap-1">
            <div className="flex items-center justify-between text-sm">
              <div className="font-medium">{item.topic}</div>
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span>prio {item.priority}</span>
                <span className="uppercase">{item.status}</span>
              </div>
            </div>
            {item.why && (
              <div className="text-xs text-slate-300">{item.why}</div>
            )}
            {item.notes && (
              <div className="text-[10px] text-slate-400 mt-1 whitespace-pre-wrap">{item.notes}</div>
            )}
            <div className="text-[10px] text-slate-500 mt-1 text-right">
              {new Date(item.created_at).toLocaleString()}
            </div>
          </div>
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
        error: 'Supabase client not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
      }
    };
  }

  const { data, error } = await supabase
    .from('agent_learning_backlog')
    .select('*')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    return {
      props: {
        items: [],
        error: error.message
      }
    };
  }

  return {
    props: {
      items: data ?? []
    }
  };
};
