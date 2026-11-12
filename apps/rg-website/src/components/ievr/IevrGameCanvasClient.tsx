"use client";

import dynamic from "next/dynamic";

export const IevrGameCanvasClient = dynamic(
  () =>
    import("@/components/ievr/IevrGameCanvas").then(
      (mod) => mod.IevrGameCanvas,
    ),
  { ssr: false, loading: () => null },
);
