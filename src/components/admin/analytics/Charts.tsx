"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Validated categorical order (colour-blind safe on white): rose, violet, teal, amber, blue.
export const SERIES = ["#D94F91", "#6B4A8C", "#00918A", "#B36A00", "#3E6FC4"];
const AXIS = { stroke: "#7a6a74", fontSize: 11, tickLine: false, axisLine: false } as const;
const GRID = <CartesianGrid stroke="#ece4e8" strokeDasharray="0" vertical={false} />;
const tooltipStyle = { borderRadius: 12, border: "1px solid #ece4e8", boxShadow: "0 12px 30px -16px rgba(37,25,35,.35)", fontSize: 12 };

type Row = Record<string, string | number>;

function compactMoney(currency: string) {
  return (v: number) => {
    const major = v / 100;
    const sym = currency === "NGN" ? "₦" : `${currency} `;
    if (Math.abs(major) >= 1_000_000) return `${sym}${(major / 1_000_000).toFixed(1)}m`;
    if (Math.abs(major) >= 1_000) return `${sym}${(major / 1_000).toFixed(major >= 10_000 ? 0 : 1)}k`;
    return `${sym}${major.toFixed(0)}`;
  };
}
function fullMoney(currency: string) {
  return (v: number) => new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en", { style: "currency", currency, maximumFractionDigits: 2 }).format(v / 100);
}

export function RevenueChart({ data, currency }: { data: Row[]; currency: string }) {
  return (
    <div className="h-64" role="img" aria-label={`Sales revenue in ${currency} over time`}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.28} />
              <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0} />
            </linearGradient>
          </defs>
          {GRID}
          <XAxis dataKey="label" {...AXIS} minTickGap={16} />
          <YAxis {...AXIS} width={56} tickFormatter={compactMoney(currency)} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fullMoney(currency)(Number(v)), "Revenue"]} cursor={{ stroke: "#251923", strokeOpacity: 0.2 }} />
          <Area type="monotone" dataKey="revenue" stroke={SERIES[0]} strokeWidth={2} fill="url(#rev)" activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} isAnimationActive />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OrdersChart({ data }: { data: Row[] }) {
  return (
    <div className="h-64" role="img" aria-label="Orders placed and paid orders over time">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
          {GRID}
          <XAxis dataKey="label" {...AXIS} minTickGap={16} />
          <YAxis {...AXIS} width={32} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#fbe4ee", fillOpacity: 0.5 }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="orders" name="Orders placed" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="paid_orders" name="Paid (qualifying)" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrafficChart({ data }: { data: Row[] }) {
  return (
    <div className="h-64" role="img" aria-label="Unique visitors and page views over time">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {GRID}
          <XAxis dataKey="label" {...AXIS} minTickGap={16} />
          <YAxis {...AXIS} width={36} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "#251923", strokeOpacity: 0.2 }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="page_views" name="Page views" stroke={SERIES[1]} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} />
          <Line type="monotone" dataKey="visitors" name="Unique visitors" stroke={SERIES[0]} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FeedbackTrendChart({ data }: { data: Row[] }) {
  return (
    <div className="h-64" role="img" aria-label="Feedback submissions over time by sentiment">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {GRID}
          <XAxis dataKey="label" {...AXIS} minTickGap={16} />
          <YAxis {...AXIS} width={32} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#fbe4ee", fillOpacity: 0.5 }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="positive" name="Positive" stackId="s" fill={SERIES[0]} stroke="#fff" strokeWidth={1} maxBarSize={24} />
          <Bar dataKey="neutral" name="Neutral" stackId="s" fill={SERIES[3]} stroke="#fff" strokeWidth={1} maxBarSize={24} />
          <Bar dataKey="negative" name="Negative" stackId="s" fill={SERIES[1]} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
