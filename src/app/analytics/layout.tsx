import type { ReactNode } from "react";

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="analytics-dashboard min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <style>{`
        @media print {
          .analytics-dashboard {
            background: white !important;
            color: black !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .rounded-xl, .shadow-sm {
            box-shadow: none !important;
            break-inside: avoid;
          }
        }
      `}</style>
      {children}
    </div>
  );
}
