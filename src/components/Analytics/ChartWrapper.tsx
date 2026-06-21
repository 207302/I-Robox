import type { ReactNode } from "react";

type ChartWrapperProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
};

export default function ChartWrapper({ title, subtitle, children, className = "" }: ChartWrapperProps) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className}`}
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
        {subtitle ? (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
