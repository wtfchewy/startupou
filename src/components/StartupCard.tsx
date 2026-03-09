"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import { StartupData } from "@/lib/stripe-data";

interface Props {
  startup: StartupData;
}

function formatCurrency(value: number): string {
  if (value >= 10000) return `$${(value / 1000).toFixed(0)}k`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value}`;
}

export default function StartupCard({ startup }: Props) {
  return (
    <div className="flex min-h-[280px] flex-col overflow-hidden rounded-2xl bg-white p-4 lg:min-h-0 lg:p-[1.2vw]">
      {/* Header */}
      <div className="mb-[0.5vh] flex items-start justify-between">
        <div>
          <div className="flex items-center gap-[0.5vw]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={startup.logo}
              alt={startup.name}
              className="h-8 w-8 rounded-lg object-contain"
            />
            <h3 className="text-[1.5rem] font-bold leading-tight text-black">
              {startup.name}
            </h3>
          </div>
          <p className="text-sm text-gray-500">{startup.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-gray-200 px-3 py-1">
          <span className="text-sm font-semibold text-gray-800">
            {formatCurrency(startup.mrr)}/mo
          </span>
        </div>
      </div>

      {/* Metrics row */}
      <div className="mb-[0.3vh] flex gap-[1vw] text-sm">
        <span className="text-gray-500">
          This month:{" "}
          <span className="font-semibold text-black">
            {formatCurrency(startup.revenueThisMonth)}
          </span>
        </span>
        <span className="text-gray-500">
          Growth:{" "}
          <span
            className={`font-semibold ${startup.growthRate > 0
              ? "text-emerald-600"
              : startup.growthRate < 0
                ? "text-red-500"
                : "text-gray-400"
              }`}
          >
            {startup.growthRate > 0 ? "+" : ""}
            {startup.growthRate}%
          </span>
        </span>
        <span className="text-gray-500">
          Customers:{" "}
          <span className="font-semibold text-black">
            {startup.customers.toLocaleString()}
          </span>
        </span>
        <div className="flex-1" />
        <span className="text-gray-500">
          Founded:{" "}
          <span className="font-semibold text-black">{startup.founded}</span>
        </span>
      </div>

      {/* Chart */}
      <div className="mt-auto min-h-[60px] flex-1 pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={startup.monthlyRevenue}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          >
            <defs>
              <linearGradient
                id={`fill-${startup.name.replace(/\s/g, "")}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              stroke="#9ca3af"
              fontSize="0.75rem"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#9ca3af"
              fontSize="0.75rem"
              tickLine={false}
              axisLine={false}
              tickFormatter={formatCurrency}
              width={45}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#f59e0b"
              strokeWidth={2}
              fill={`url(#fill-${startup.name.replace(/\s/g, "")})`}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-row items-center justify-between">
        {startup.founders.length > 0 && (
          <div className="flex items-center gap-[0.8vw] pt-[1vh]">

            {startup.founders.map((founder) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <div key={founder.linkedin} className="flex items-center gap-[0.5vw]">
                <img
                  src={founder.photo}
                  alt={founder.name}
                  className="h-6 w-6 rounded-full object-cover"
                />
                <span className="text-xs text-gray-500">
                  {founder.name}
                </span>
              </div>
            ))}
          </div>
        )}
        <span className="text-sm">{startup.domain}</span>
      </div>
    </div>
  );
}
