import type { ReactNode } from "react";
import { AnalyticsThemeProvider } from "@/components/Analytics/AnalyticsThemeProvider";

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return (
    <AnalyticsThemeProvider>
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
    </AnalyticsThemeProvider>
  );
}
