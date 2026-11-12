"use client";

import { useEffect, useRef } from "react";
import { startNieHost, type NieHost } from "@/lib/nie-client-host";

/**
 * Fullscreen host canvas for `NieClientRuntime`. No DOM text, no HUD: everything the player sees
 * is drawn by the runtime (`@/lib/nie-client-host`).
 */
export function IevrGameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let host: NieHost | null = null;
    let cancelled = false;
    startNieHost(canvas).then(
      (h) => {
        if (cancelled) h.stop();
        else host = h;
      },
      (err) => console.error("nie runtime", err),
    );
    return () => {
      cancelled = true;
      host?.stop();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      role="application"
      aria-label="Inazuma Eleven: Victory Road"
      tabIndex={0}
      className="fixed inset-0 block h-screen w-screen touch-none select-none bg-black outline-none"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}
