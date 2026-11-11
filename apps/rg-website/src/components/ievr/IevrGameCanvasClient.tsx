"use client";

import dynamic from "next/dynamic";

export const IevrGameCanvasClient = dynamic(
  () => import("@/components/ievr/IevrGameCanvas").then(mod => mod.IevrGameCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-16/9 max-w-6xl mx-auto bg-black/90 rounded-2xl flex flex-col items-center justify-center p-6 text-center border border-white/10">
        <div className="size-14 border-4 border-[#F4D03F]/20 border-t-[#F4D03F] rounded-full animate-spin mb-4" />
        <p className="text-white/60 text-sm font-semibold">Initialisation du moteur IEVR WebAssembly...</p>
      </div>
    ),
  }
);
