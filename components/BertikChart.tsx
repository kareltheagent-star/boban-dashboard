import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export interface ChartPoint {
  date: string;
  cumROI: number;
}

const C = {
  border:   "#263a55",
  textSec:  "#7a9ab8",
  textMuted:"#4d6a85",
};

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div style={{
      background: "#17243a",
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: "8px 12px",
      fontSize: 12,
      color: "#dde9f8",
    }}>
      <div style={{ color: C.textMuted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 600, color: val >= 0 ? "#34d399" : "#f87171" }}>
        {val >= 0 ? "+" : ""}{val.toFixed(2)} units
      </div>
    </div>
  );
}

export default function BertikChart({ data }: { data: ChartPoint[] }) {
  if (!data.length) {
    return (
      <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, fontSize: 13 }}>
        No settled bets yet — chart will appear here.
      </div>
    );
  }

  const min = Math.min(...data.map(d => d.cumROI));
  const max = Math.max(...data.map(d => d.cumROI));
  const pad = Math.max(Math.abs(min), Math.abs(max)) * 0.15 + 0.5;
  const lineColor = data[data.length - 1]?.cumROI >= 0 ? "#34d399" : "#f87171";

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: C.textMuted, fontSize: 11 }}
          axisLine={{ stroke: C.border }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: C.textMuted, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={48}
          domain={[min - pad, max + pad]}
          tickFormatter={v => `${v > 0 ? "+" : ""}${v.toFixed(1)}`}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke={C.border} strokeDasharray="4 2" />
        <Line
          type="monotone"
          dataKey="cumROI"
          stroke={lineColor}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: lineColor, stroke: "#17243a", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
