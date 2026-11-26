import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Ticket } from "@/types/ticket";

const SEVERITY_COLORS: Record<string, string> = {
  Critical: "#DC6464",
  High: "#D99A45",
  Medium: "#2E5D4B",
  Low: "#648DAA",
};

export function PriorityDistributionChart({ tickets }: { tickets: Ticket[] }) {
  const openTickets = tickets.filter((t) => t.status !== "resolved");

  const data = [
    {
      name: "Critical",
      count: openTickets.filter((t) => t.severity === "critical").length,
    },
    {
      name: "High",
      count: openTickets.filter((t) => t.severity === "high").length,
    },
    {
      name: "Medium",
      count: openTickets.filter((t) => t.severity === "medium").length,
    },
    {
      name: "Low",
      count: openTickets.filter((t) => t.severity === "low").length,
    },
  ];

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          <XAxis
            dataKey="name"
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
            cursor={{ fill: "#E8F3EF", opacity: 0.45 }}
            contentStyle={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "12px",
              fontSize: "12px",
              boxShadow: "0 4px 16px rgba(15, 23, 42, 0.08)",
            }}
          />
          <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={38}>
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={SEVERITY_COLORS[entry.name] ?? "#2E5D4B"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
