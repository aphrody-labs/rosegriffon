/**
 * steam-browser-streamer.ts - Streams real rendered local Steam game frames to the VPS bridge
 *
 * Captures rendered frames from local `nie play` software rasterizer / WGPU WebGL headless engine
 * and streams them via HTTP POST /stream/frame to the remote VPS nie-bridge-service (port 8899).
 */

import { spawn } from "node:child_process";
import { readFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const VPS_BRIDGE_URL = process.env.VPS_BRIDGE_URL || "http://51.77.147.152:8899/stream/frame";
const FRAME_PPM = join(process.cwd(), "var", "stream_tmp.ppm");

async function renderFrame(frameIdx: number): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const child = spawn("nie.exe", ["play", "--frames", "1", "--out", FRAME_PPM, "--json"], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.on("close", (code) => {
      if (code === 0 && existsSync(FRAME_PPM)) {
        const data = readFileSync(FRAME_PPM);
        try {
          unlinkSync(FRAME_PPM);
        } catch {}
        resolve(data);
      } else {
        resolve(null);
      }
    });
  });
}

async function streamLoop(maxFrames = 10) {
  console.log(`[steam-browser-streamer] Connecting to VPS bridge at ${VPS_BRIDGE_URL}...`);
  for (let i = 1; i <= maxFrames; i++) {
    const frameData = await renderFrame(i);
    if (!frameData) {
      console.warn(`[steam-browser-streamer] Failed to render frame ${i}`);
      continue;
    }

    try {
      const resp = await fetch(VPS_BRIDGE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "image/x-portable-pixmap",
          "X-Frame-Index": i.toString(),
        },
        body: frameData,
      });
      const resJson = await resp.json();
      console.log(`[steam-browser-streamer] Frame ${i}/${maxFrames} pushed -> status: ${resp.status}`, resJson);
    } catch (err: any) {
      console.error(`[steam-browser-streamer] Error sending frame ${i}: ${err.message}`);
    }
  }
}

if (import.meta.main) {
  streamLoop(5).catch(console.error);
}
