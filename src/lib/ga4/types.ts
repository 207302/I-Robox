export const CURRENCY_CODE = "INR";
export const CURRENCY_SYMBOL = "₹";

export const CHART_COLORS = {
  primary: "#4285F4",
  secondary: "#34A853",
  tertiary: "#FBBC05",
  quaternary: "#EA4335",
  purple: "#8B5CF6",
  cyan: "#06B6D4",
  orange: "#F97316",
  slate: "#64748B",
} as const;

export const CHANNEL_COLORS: Record<string, string> = {
  Organic: CHART_COLORS.primary,
  "Organic Search": CHART_COLORS.primary,
  Direct: CHART_COLORS.secondary,
  Paid: CHART_COLORS.tertiary,
  "Paid Search": CHART_COLORS.tertiary,
  Social: CHART_COLORS.quaternary,
  "Organic Social": CHART_COLORS.quaternary,
  Referral: CHART_COLORS.purple,
  Email: CHART_COLORS.cyan,
  Display: CHART_COLORS.orange,
  "Cross-network": CHART_COLORS.slate,
  Unassigned: CHART_COLORS.slate,
};

export type DateRange = {
  startDate: string;
  endDate: string;
};

export type ApiResponse<T> = {
  data: T;
  cached: boolean;
  startDate: string;
  endDate: string;
};

export type ApiErrorResponse = {
  error: string;
};

export type MetricSnapshot = {
  sessions: number;
  totalUsers: number;
  newUsers: number;
  engagedSessions: number;
  averageSessionDuration: number;
  purchaseRevenue: number;
  transactions: number;
  conversionRate: number;
  averagePurchaseRevenue: number;
};

export type ExecutiveSummaryData = {
  current: MetricSnapshot;
  previous: MetricSnapshot;
};

export type TrafficRow = {
  channel: string;
  users: number;
  sessions: number;
  revenue: number;
  conversionRate: number;
  percentOfSessions: number;
};

export type TrafficAcquisitionData = {
  rows: TrafficRow[];
  totals: {
    users: number;
    sessions: number;
    revenue: number;
  };
};

export type ProductRow = {
  rank: number;
  name: string;
  category: string;
  revenue: number;
  quantity: number;
};

export type RevenueTrendPoint = {
  date: string;
  label: string;
  revenue: number;
};

export type EcommercePerformanceData = {
  transactions: number;
  purchaseRevenue: number;
  conversionRate: number;
  averagePurchaseRevenue: number;
  topProducts: ProductRow[];
  revenueTrend: RevenueTrendPoint[];
};

export type LandingPageRow = {
  page: string;
  users: number;
  sessions: number;
  engagementRate: number;
  conversions: number;
  revenue: number;
};

export type LandingPageAnalysisData = {
  rows: LandingPageRow[];
};

export type GeoRow = {
  rank: number;
  country: string;
  countryCode: string;
  city: string;
  users: number;
  revenue: number;
  transactions: number;
};

export type GeographicData = {
  rows: GeoRow[];
};

export type DeviceRow = {
  device: string;
  users: number;
  sessions: number;
  conversionRate: number;
  revenue: number;
};

export type DeviceData = {
  rows: DeviceRow[];
  totals: {
    users: number;
    sessions: number;
    revenue: number;
  };
};

export type BehaviourRow = {
  pagePath: string;
  pageViews: number;
  avgTime: number;
  exitRate: number;
  users: number;
};

export type UserBehaviourData = {
  rows: BehaviourRow[];
};

export type ChartDataPoint = {
  name: string;
  value: number;
  fill?: string;
};

export type MetricCardProps = {
  label: string;
  value: number;
  previousValue?: number;
  formatter?: (value: number) => string;
  prefix?: string;
  suffix?: string;
};

export type DashboardExportData = {
  summary: ExecutiveSummaryData | null;
  traffic: TrafficAcquisitionData | null;
  ecommerce: EcommercePerformanceData | null;
  pages: LandingPageAnalysisData | null;
  geo: GeographicData | null;
  devices: DeviceData | null;
  behaviour: UserBehaviourData | null;
  dateRange: DateRange;
};
