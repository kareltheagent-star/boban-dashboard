import { useState, FormEvent } from 'react';
import { GetServerSideProps } from 'next';
import { supabase } from '../lib/supabaseClient';

interface BacklogItem {
  id: number;
  title: string;
  description: string | null;
  priority: number;
  status: 'pending' | 'in_progress' | 'done' | 'blocked';
  tags: string[] | null;
  created_by: 'human' | 'boban';
  created_at: string;
}

interface Props {
  items: BacklogItem[];
  error?: string;
}

export default function BacklogPage({ items, error }: Props) {
  const [localItems, setLocalItems] = useState<BacklogItem[]>(items);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<number>(3);
  const [status, setStatus] = useState<BacklogItem['status']>('pending');
  const [tags, setTags] = useState('');

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setPriority(3);
    setStatus('pending');
    setTags('');
    setFormError(null);
  };

  const onEdit = (item: BacklogItem) => {
    setEditingId(item.id);
    setTitle(item.title);
    setDescription(item.description ?? '');
    setPriority(item.priority);
    setStatus(item.status);
    setTags(item.tags ? item.tags.join(', ') : '');
    setFormError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!supabase) {
      setFormError('Supabase client not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }

    if (!title.trim()) {
      setFormError('Title is required');
      return;
    }

    setFormLoading(true);

    const payload: any = {
      title: title.trim(),
      description: description.trim() || null,
      priority: Number(priority) || 3,
      status,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };

    if (!payload.tags.length) {
      payload.tags = null;
    }

    try {
      if (editingId == null) {
        // Create new
        const { data, error: insertError } = await supabase
          .from('agent_backlog')
          .insert({
            ...payload,
            created_by: 'human',
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
          resetForm();
        }
      } else {
        // Update existing
        const { data, error: updateError } = await supabase
          .from('agent_backlog')
          .update(payload)
          .eq('id', editingId)
          .select()
          .single();

        if (updateError) {
          setFormError(updateError.message);
        } else if (data) {
          setLocalItems((prev) =>
            prev
              .map((item) => (item.id === editingId ? data : item))
              .sort((a, b) => {
                if (a.priority === b.priority) {
                  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                }
                return a.priority - b.priority;
              })
          );
          resetForm();
        }
      }
    } catch (err: any) {
      setFormError(err.message ?? 'Unknown error while saving backlog item');
    } finally {
      setFormLoading(false);
    }
  };

  if (error) {
    return <p className="text-red-400 text-sm">{error}</p>;
  }

  const columns: { key: BacklogItem['status']; title: string }[] = [
    { key: 'pending',      title: 'Pending' },
    { key: 'in_progress',  title: 'In Progress' },
    { key: 'done',         title: 'Done' },
    { key: 'blocked',      title: 'Blocked' },
  ];

  const grouped: Record<BacklogItem['status'], BacklogItem[]> = {
    pending: [],
    in_progress: [],
    done: [],
    blocked: [],
  };

  for (const item of localItems) {
    grouped[item.status].push(item);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Agent backlog</h1>
        <p className="text-slate-400 text-sm">
          Kanban view of tasks for Boban. Click a card to edit, or change its status to move columns.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-slate-800 p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">
            {editingId == null ? 'Add backlog item' : `Edit backlog item #${editingId}`}
          </h2>
          {editingId != null && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Title</label>
            <input
              className="w-full rounded bg-slate-950 border border-slate-800 px-2 py-1 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short task title"
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
          <label className="text-xs text-slate-400">Description</label>
          <textarea
            className="w-full rounded bg-slate-950 border border-slate-800 px-2 py-1 text-sm min-h-[60px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Details, acceptance criteria, notes for Boban..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Status</label>
            <select
              className="w-full rounded bg-slate-950 border border-slate-800 px-2 py-1 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as BacklogItem['status'])}
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Tags (comma separated)</label>
            <input
              className="w-full rounded bg-slate-950 border border-slate-800 px-2 py-1 text-sm"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="infra, dashboard, experiment"
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
            {formLoading
              ? editingId == null
                ? 'Creating...'
                : 'Saving...'
              : editingId == null
              ? 'Add item'
              : 'Save changes'}
          </button>
        </div>
      </form>

      <div className="space-y-2">
        <h2 className="text-sm font-medium">Kanban board</h2>
        {localItems.length === 0 && (
          <p className="text-slate-500 text-sm">No backlog items yet.</p>
        )}
        {localItems.length > 0 && (
          <div className="grid gap-4 md:grid-cols-4">
            {columns.map((col) => (
              <div key={col.key} className="space-y-2">
                <div className="text-xs font-medium text-slate-300">
                  {col.title}
                  <span className="text-slate-500"> ({grouped[col.key].length})</span>
                </div>
                <div className="space-y-2">
                  {grouped[col.key].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onEdit(item)}
                      className="w-full text-left rounded-lg border border-slate-800 p-3 flex flex-col gap-1 hover:border-slate-600 bg-slate-950"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <div className="font-medium">{item.title}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-2">
                          <span>prio {item.priority}</span>
                        </div>
                      </div>
                      {item.description && (
                        <div className="text-xs text-slate-300 line-clamp-2">{item.description}</div>
                      )}
                      <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                        <div>
                          {item.tags && item.tags.length > 0 &&
                            item.tags.map((t) => (
                              <span
                                key={t}
                                className="inline-block mr-1 px-1 py-0.5 rounded bg-slate-800 text-slate-300"
                              >
                                {t}
                              </span>
                            ))}
                        </div>
                        <div>
                          {item.created_by} · {new Date(item.created_at).toLocaleString()}
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Status:</span>
                        <select
                          className="rounded bg-slate-950 border border-slate-800 px-1 py-0.5 text-[10px]"
                          value={item.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={async (e) => {
                            const nextStatus = e.target.value as BacklogItem['status'];
                            if (!supabase || nextStatus === item.status) return;
                            try {
                              const { data, error: updateError } = await supabase
                                .from('agent_backlog')
                                .update({ status: nextStatus })
                                .eq('id', item.id)
                                .select()
                                .single();

                              if (!updateError && data) {
                                setLocalItems((prev) =>
                                  prev
                                    .map((it) => (it.id === item.id ? data : it))
                                    .sort((a, b) => {
                                      if (a.priority === b.priority) {
                                        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                                      }
                                      return a.priority - b.priority;
                                    }),
                                );
                              }
                            } catch {
                              // ignore for now; form edit path is the fallback
                            }
                          }}
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In progress</option>
                          <option value="blocked">Blocked</option>
                          <option value="done">Done</option>
                        </select>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  if (!supabase) {
    return {
      props: {
        items: [],
        error:
          'Supabase client not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      },
    };
  }

  const { data, error } = await supabase
    .from('agent_backlog')
    .select('*')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    return {
      props: {
        items: [],
        error: error.message,
      },
    };
  }

  return {
    props: {
      items: data ?? [],
    },
  };
};