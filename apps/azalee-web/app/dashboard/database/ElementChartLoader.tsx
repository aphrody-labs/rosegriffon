"use client";

import dynamic from "next/dynamic";

const ElementChart = dynamic(
  () => import("@/components/dashboard/database/element-chart").then((m) => m.ElementChart),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse bg-surface-container rounded-2xl" />,
  },
);

export function ElementChartLoader(props: any) {
  return <ElementChart {...props} />;
}
