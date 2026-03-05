import { GetServerSideProps } from 'next';
import { supabase } from '../lib/supabaseClient';

interface StatusRow {
  id: number;
  ts: string;
  current_task: string | null;
  mac_ram_pct: number | null;
  mac_cpu_pct: string | null;
  mac_disk_pct: number | null;
  gateway_running: boolean | null;
  last_message: string | null;
}

interface Props {
  latestStatus: StatusRow | null;
  error?: string;
}

export default function StatusPage({ latestStatus, error }: Props) {
  if (error) {
    return <p className="text-red-400 text-sm">{error}</p>;
  }

  if (!latestStatus) {
    return <p className="text-slate-400 text-sm">No status data yet. Run push-status.sh or wait for cron.</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Current status</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-800 p-4">
          <div className="text-xs uppercase text-slate-400 mb-1">Timestamp</div>
          <div className="text-sm">{new Date(latestStatus.ts).toLocaleString()}</div>
        </div>
        <div className="rounded-lg border border-slate-800 p-4">
          <div className="text-xs uppercase text-slate-400 mb-1">Current task</div>
          <div className="text-sm">{latestStatus.current_task ?? '—'}</div>
        </div>
        <div className="rounded-lg border border-slate-800 p-4">
          <div className="text-xs uppercase text-slate-400 mb-1">Mac RAM %</div>
          <div className="text-2xl font-mono">{latestStatus.mac_ram_pct ?? '—'}%</div>
        </div>
        <div className="rounded-lg border border-slate-800 p-4">
          <div className="text-xs uppercase text-slate-400 mb-1">CPU load (1m)</div>
          <div className="text-2xl font-mono">{latestStatus.mac_cpu_pct ?? '—'}</div>
        </div>
        <div className="rounded-lg border border-slate-800 p-4">
          <div className="text-xs uppercase text-slate-400 mb-1">Disk free %</div>
          <div className="text-2xl font-mono">{latestStatus.mac_disk_pct ?? '—'}%</div>
        </div>
        <div className="rounded-lg border border-slate-800 p-4">
          <div className="text-xs uppercase text-slate-400 mb-1">Gateway</div>
          <div className="text-sm">
            {latestStatus.gateway_running == null
              ? 'unknown'
              : latestStatus.gateway_running
              ? 'running'
              : 'stopped'}
          </div>
        </div>
      </div>
      {latestStatus.last_message && (
        <div className="rounded-lg border border-slate-800 p-4">
          <div className="text-xs uppercase text-slate-400 mb-1">Last message</div>
          <div className="text-xs text-slate-300 whitespace-pre-wrap">{latestStatus.last_message}</div>
        </div>
      )}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  if (!supabase) {
    return {
      props: {
        latestStatus: null,
        error: 'Supabase client not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
      }
    };
  }

  const { data, error } = await supabase
    .from<StatusRow>('agent_status')
    .select('*')
    .order('ts', { ascending: false })
    .limit(1);

  if (error) {
    return {
      props: {
        latestStatus: null,
        error: error.message
      }
    };
  }

  return {
    props: {
      latestStatus: data?.[0] ?? null
    }
  };
};
