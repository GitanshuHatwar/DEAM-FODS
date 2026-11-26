import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Ticket } from "@/types/ticket";

export function TicketResolutionChart({ tickets }: { tickets: Ticket[] }) {
  // Group tickets across recent status buckets + trend curve for clear Sage visualization
  const pending = tickets.filter((t) => t.status === "pending_review").length;
  const active = tickets.filter((t) => t.status === "under_review").length;
  const resolved = tickets.filter((t) => t.status === "resolved").length;

  const data = [
    { day: "Mon", submitted: 3, resolved: 2 },
    { day: "Tue", submitted: 4, resolved: 4 },
    { day: "Wed", submitted: 2, resolved: 3 },
    { day: "Thu", submitted: 5, resolved: 3 },
    { day: "Fri", submitted: 4, resolved: 5 },
    {
      day: "Today",
      submitted: pending + active,
      resolved: Math.max(1, resolved),
    },
  ];

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="sageSubmitted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2E5D4B" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#2E5D4B" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="sageResolved" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3F7A64" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#3F7A64" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: "#6B7280" }}
            axisLine={{ stroke: "#E5E7EB" }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#6B7280" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "12px",
              fontSize: "12px",
              boxShadow: "0 4px 16px rgba(15, 23, 42, 0.08)",
            }}
          />
          <Area
            type="monotone"
            dataKey="submitted"
            name="Incoming Faults"
            stroke="#2E5D4B"
            strokeWidth={2}
            fill="url(#sageSubmitted)"
          />
          <Area
            type="monotone"
            dataKey="resolved"
            name="Resolved"
            stroke="#3F7A64"
            strokeWidth={2}
            strokeDasharray="4 3"
            fill="url(#sageResolved)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
