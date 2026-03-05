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
  if (error) {
    return <p className="text-red-400 text-sm">{error}</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Learning backlog</h1>
      <p className="text-slate-400 text-sm">Read-only list of topics I should study next.</p>
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="text-slate-500 text-sm">No learning items yet.</p>
        )}
        {items.map((item) => (
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
    .from<LearningItem>('agent_learning_backlog')
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
