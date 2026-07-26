"use client";

import { useMemo } from "react";

export function StatsChart() {
  const points = useMemo(
    () => [18, 22, 20, 28, 26, 34, 31, 40, 38, 48, 44, 56, 52, 63, 60, 72],
    [],
  );

  const width = 560;
  const height = 180;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const path = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((value - min) / (max - min || 1)) * (height - 24) - 12;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="card animate-rise-delay-1 flex h-full flex-col p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">
            Statistics
          </h2>
          <p className="text-sm text-ink-muted">Динамика лучших курсов</p>
        </div>
        <div className="flex gap-2">
          {["All", "BTC", "USDT"].map((label, i) => (
            <span
              key={label}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                i === 0
                  ? "bg-accent text-white"
                  : "bg-bg-soft text-ink-muted"
              }`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="relative mt-auto overflow-hidden rounded-xl">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-44 w-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--chart)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`${path} L ${width} ${height} L 0 ${height} Z`}
            fill="url(#chartFill)"
          />
          <path
            d={path}
            fill="none"
            stroke="var(--chart)"
            strokeWidth="3"
            className="chart-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
