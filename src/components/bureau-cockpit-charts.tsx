"use client";

import { useId } from "react";

export type DonutSegment = {
  label: string;
  value: number;
  color: string;
};

type DonutChartProps = {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerValue: string | number;
  centerLabel: string;
  ariaLabel: string;
  trackColor?: string;
  centerColor?: string;
  labelColor?: string;
};

export function DonutChart({
  segments,
  size = 200,
  thickness = 20,
  centerValue,
  centerLabel,
  ariaLabel,
  trackColor = "rgba(255,255,255,0.12)",
  centerColor = "#ffffff",
  labelColor = "rgba(255,255,255,0.55)",
}: DonutChartProps) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-full w-full"
      role="img"
      aria-label={ariaLabel}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={thickness}
      />
      {total > 0
        ? segments.map((segment) => {
            const value = Math.max(0, segment.value);
            if (value === 0) return null;

            const fraction = value / total;
            const dash = Math.max(0, fraction * circumference - 2);
            const rotation = (cumulative / total) * 360 - 90;
            cumulative += value;

            return (
              <circle
                key={segment.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={thickness}
                strokeLinecap="butt"
                strokeDasharray={`${dash} ${circumference - dash}`}
                transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
              />
            );
          })
        : null}
      <text
        x="50%"
        y="47%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={centerColor}
        fontSize={size * 0.16}
        fontWeight="600"
        letterSpacing="-0.04em"
      >
        {centerValue}
      </text>
      <text
        x="50%"
        y="60%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={labelColor}
        fontSize={size * 0.055}
        fontWeight="500"
      >
        {centerLabel}
      </text>
    </svg>
  );
}

type RadialProgressProps = {
  value: number;
  size?: number;
  thickness?: number;
  color?: string;
  label?: string;
};

export function RadialProgress({
  value,
  size = 112,
  thickness = 10,
  color = "#10b981",
  label = "Progression",
}: RadialProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-28 w-28 shrink-0"
      role="img"
      aria-label={`${label} : ${Math.round(clamped)} %`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={thickness}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="49%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#0f172a"
        fontSize={size * 0.18}
        fontWeight="600"
        letterSpacing="-0.04em"
      >
        {Math.round(clamped)}%
      </text>
      <text
        x="50%"
        y="62%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#94a3b8"
        fontSize={size * 0.075}
        fontWeight="500"
      >
        finalisés
      </text>
    </svg>
  );
}

export type BarDatum = {
  label: string;
  value: number;
  color?: string;
};

type BarChartProps = {
  data: BarDatum[];
  height?: number;
  color?: string;
  ariaLabel: string;
  valueSuffix?: string;
};

export function BarChart({
  data,
  height = 170,
  color = "#0891b2",
  ariaLabel,
  valueSuffix = "",
}: BarChartProps) {
  const max = Math.max(1, ...data.map((datum) => datum.value));

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="flex items-end gap-2"
      style={{ height }}
    >
      {data.map((datum) => (
        <div
          key={datum.label}
          className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
        >
          <div className="relative flex w-full flex-1 items-end justify-center">
            <div
              className="w-full max-w-9 rounded-t-[10px] transition-all duration-500 ease-out group-hover:opacity-90"
              style={{
                height: `${Math.max(5, (datum.value / max) * 100)}%`,
                backgroundColor: datum.color ?? color,
                opacity: datum.value === 0 ? 0.22 : 1,
              }}
              title={`${datum.label} : ${datum.value}${valueSuffix}`}
            />
          </div>
          <span className="w-full truncate text-center text-[10px] font-medium text-slate-500">
            {datum.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export type StackedBarDatum = {
  label: string;
  segments: { value: number; color: string; label: string }[];
};

type StackedBarChartProps = {
  data: StackedBarDatum[];
  height?: number;
  ariaLabel: string;
};

export function StackedBarChart({
  data,
  height = 170,
  ariaLabel,
}: StackedBarChartProps) {
  const totals = data.map((datum) =>
    datum.segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0),
  );
  const max = Math.max(1, ...totals);

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="flex items-end gap-2"
      style={{ height }}
    >
      {data.map((datum, index) => {
        const total = totals[index];
        return (
          <div
            key={datum.label}
            className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
          >
            <div className="flex w-full flex-1 items-end justify-center">
              <div
                className="flex w-full max-w-9 flex-col-reverse overflow-hidden rounded-t-[10px] transition-all duration-500 ease-out group-hover:opacity-90"
                style={{
                  height: `${Math.max(5, (total / max) * 100)}%`,
                  opacity: total === 0 ? 0.22 : 1,
                }}
              >
                {datum.segments.map((segment) =>
                  segment.value > 0 ? (
                    <div
                      key={segment.label}
                      style={{
                        height: `${(segment.value / Math.max(1, total)) * 100}%`,
                        backgroundColor: segment.color,
                      }}
                      title={`${datum.label} — ${segment.label} : ${segment.value}`}
                    />
                  ) : null,
                )}
              </div>
            </div>
            <span className="w-full truncate text-center text-[10px] font-medium text-slate-500">
              {datum.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export type HorizontalBarDatum = {
  label: string;
  value: number;
  color?: string;
  caption?: string;
};

type HorizontalBarsProps = {
  data: HorizontalBarDatum[];
  color?: string;
  ariaLabel: string;
};

export function HorizontalBars({
  data,
  color = "#0891b2",
  ariaLabel,
}: HorizontalBarsProps) {
  const max = Math.max(1, ...data.map((datum) => datum.value));

  return (
    <div role="img" aria-label={ariaLabel} className="space-y-3.5">
      {data.map((datum) => (
        <div key={datum.label}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate font-medium text-slate-700">{datum.label}</span>
            <span className="shrink-0 font-semibold text-slate-950">{datum.value}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${(datum.value / max) * 100}%`,
                backgroundColor: datum.color ?? color,
              }}
            />
          </div>
          {datum.caption ? (
            <p className="mt-1 text-[11px] text-slate-400">{datum.caption}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

type SparklineProps = {
  values: number[];
  height?: number;
  color?: string;
  ariaLabel: string;
};

export function Sparkline({
  values,
  height = 48,
  color = "#0891b2",
  ariaLabel,
}: SparklineProps) {
  const gradientId = useId().replace(/:/g, "");
  const width = 120;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - 4 - (value / max) * (height - 10);
    return [x, y] as const;
  });
  const line = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height }}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.26" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
