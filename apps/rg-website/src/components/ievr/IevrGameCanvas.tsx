"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { loadGame, type GameHandle, KEY_TO_COMMAND } from "@/lib/nie-game";
import {
  Gamepad2,
  Maximize2,
  Minimize2,
  Sparkles,
  Info,
} from "lucide-react";

export function IevrGameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<GameHandle | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState("Chargement du WebAssembly IEVR (Rust 2024)...");
  const [error, setError] = useState<string | null>(null);
  const [inMatch, setInMatch] = useState(false);
  const [score, setScore] = useState<[number, number]>([0, 0]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fps, setFps] = useState(60);
  const [controlsOpen, setControlsOpen] = useState(false);

  // Keyboard navigation state
  const keysPressed = useRef<Set<string>>(new Set());

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Prevent default scrolling on arrow keys and space
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
    keysPressed.current.add(e.code);

    const cmd = KEY_TO_COMMAND[e.code];
    if (cmd && gameRef.current) {
      gameRef.current.input(cmd);
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    keysPressed.current.delete(e.code);
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsTimer = performance.now();

    async function init() {
      try {
        setLoadingProgress("Téléchargement du moteur Wasm (nie_wasm_bg.wasm)...");
        const game = await loadGame();
        gameRef.current = game;
        setIsLoading(false);

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);

        // Main game render loop (60 FPS tick)
        const renderLoop = (time: number) => {
          const dt = Math.min((time - lastTime) / 1000, 0.1);
          lastTime = time;

          // Continuous movement for match mode (arrow keys or WASD)
          let dx = 0;
          let dy = 0;
          const k = keysPressed.current;
          if (k.has("ArrowRight") || k.has("KeyD")) dx += 1;
          if (k.has("ArrowLeft") || k.has("KeyA") || k.has("KeyQ")) dx -= 1;
          if (k.has("ArrowUp") || k.has("KeyW") || k.has("KeyZ")) dy -= 1;
          if (k.has("ArrowDown") || k.has("KeyS")) dy += 1;
          const shoot = k.has("Space") || k.has("Enter");

          game.setMatchInput(dx, dy, shoot);
          game.update(dt);

          // Render framebuffer to canvas
          const imgData = game.frame();
          ctx.putImageData(imgData, 0, 0);

          // Update match status & score
          const curInMatch = game.inMatch();
          setInMatch(curInMatch);
          if (curInMatch) {
            setScore(game.score());
          }

          // FPS counter
          frameCount++;
          if (time - fpsTimer >= 1000) {
            setFps(frameCount);
            frameCount = 0;
            fpsTimer = time;
          }

          animationFrameId = requestAnimationFrame(renderLoop);
        };

        animationFrameId = requestAnimationFrame(renderLoop);
      } catch (err: any) {
        console.error("Erreur de lancement d'IEVR:", err);
        setError(err.message || "Impossible d'initialiser le moteur WebAssembly IEVR.");
        setIsLoading(false);
      }
    }

    init();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Touch/On-screen directional input helper
  const sendCommand = (cmd: string) => {
    if (gameRef.current) {
      gameRef.current.input(cmd);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col items-center justify-center w-full bg-black/95 rounded-2xl overflow-hidden shadow-2xl border border-white/10 ${
        isFullscreen ? "h-screen w-screen rounded-none" : "aspect-16/9 max-w-6xl mx-auto"
      }`}
    >
      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md px-6 text-center">
          <div className="relative mb-6">
            <div className="size-16 border-4 border-[#F4D03F]/20 border-t-[#F4D03F] rounded-full animate-spin" />
            <Sparkles className="absolute inset-0 m-auto size-6 text-[#F4D03F] animate-pulse" />
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-wider mb-2">
            Inazuma Eleven: Victory Road Web
          </h2>
          <p className="text-sm text-white/60 max-w-md animate-pulse">{loadingProgress}</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-red-950/90 backdrop-blur-md p-6 text-center">
          <Info className="size-12 text-red-400 mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">Erreur d&apos;initialisation</h3>
          <p className="text-sm text-red-200/80 max-w-md mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-semibold transition"
          >
            Recharger la page
          </button>
        </div>
      )}

      {/* Main Canvas Viewport */}
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        className="w-full h-full object-contain cursor-pointer select-none"
        tabIndex={0}
      />

      {/* Top Overlay HUD Bar */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3 bg-linear-to-b from-black/80 via-black/40 to-transparent pointer-events-auto">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-bold text-white">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            IEVR WebAssembly {fps} FPS
          </span>

          {inMatch && (
            <span className="px-3 py-1 rounded-full bg-[#F07D7D]/20 border border-[#F07D7D]/40 text-xs font-black text-white">
              MATCH: {score[0]} - {score[1]}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setControlsOpen(!controlsOpen)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition"
            title="Afficher les commandes"
          >
            <Gamepad2 className="size-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition"
            title={isFullscreen ? "Quitter plein écran" : "Plein écran"}
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>
      </div>

      {/* Controls Overlay Helper Modal */}
      {controlsOpen && (
        <div className="absolute inset-0 z-25 flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
          <div className="bg-neutral-900 border border-white/15 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Gamepad2 className="size-5 text-[#F4D03F]" /> Commandes IEVR Clavier
              </h3>
              <button
                onClick={() => setControlsOpen(false)}
                className="text-white/60 hover:text-white text-xs px-2 py-1 bg-white/10 rounded-lg"
              >
                Fermer
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-white/80">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="font-semibold text-white">Flèches / ZQSD / WASD</span>
                <p className="text-white/50 text-[11px] mt-0.5">Navigation menu / Déplacement match</p>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="font-semibold text-white">Entrée / Espace</span>
                <p className="text-white/50 text-[11px] mt-0.5">Valider / Tirer au but</p>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="font-semibold text-white">Échap / Retour arrière</span>
                <p className="text-white/50 text-[11px] mt-0.5">Retour / Pause</p>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="font-semibold text-white">Touche I / Tab</span>
                <p className="text-white/50 text-[11px] mt-0.5">Infos joueur / Suivant</p>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setControlsOpen(false)}
                className="px-4 py-2 bg-[#F4D03F] text-black font-bold text-xs rounded-xl hover:bg-[#F4D03F]/90 transition"
              >
                Reprendre la partie
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Virtual Controls (Mobile / Quick touch) */}
      <div className="absolute bottom-4 inset-x-4 z-20 flex items-center justify-between pointer-events-none md:hidden">
        {/* Virtual D-Pad */}
        <div className="grid grid-cols-3 gap-1 pointer-events-auto bg-black/60 backdrop-blur-md p-2 rounded-2xl border border-white/10">
          <div />
          <button
            onClick={() => sendCommand("CMD_FCS_MTX_UP")}
            className="size-10 flex items-center justify-center bg-white/10 active:bg-white/30 rounded-xl text-white font-bold"
          >
            ▲
          </button>
          <div />
          <button
            onClick={() => sendCommand("CMD_FCS_MTX_LEFT")}
            className="size-10 flex items-center justify-center bg-white/10 active:bg-white/30 rounded-xl text-white font-bold"
          >
            ◀
          </button>
          <button
            onClick={() => sendCommand("CMD_ENTER")}
            className="size-10 flex items-center justify-center bg-[#F4D03F] active:bg-[#F4D03F]/80 rounded-xl text-black font-black text-xs"
          >
            OK
          </button>
          <button
            onClick={() => sendCommand("CMD_FCS_MTX_RIGHT")}
            className="size-10 flex items-center justify-center bg-white/10 active:bg-white/30 rounded-xl text-white font-bold"
          >
            ▶
          </button>
          <div />
          <button
            onClick={() => sendCommand("CMD_FCS_MTX_DOWN")}
            className="size-10 flex items-center justify-center bg-white/10 active:bg-white/30 rounded-xl text-white font-bold"
          >
            ▼
          </button>
          <button
            onClick={() => sendCommand("CMD_BACK")}
            className="size-10 flex items-center justify-center bg-red-500/80 active:bg-red-500 rounded-xl text-white font-bold text-[10px]"
          >
            ESC
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pointer-events-auto">
          <button
            onClick={() => sendCommand("CMD_ENTER")}
            className="size-12 rounded-full bg-[#F4D03F] active:scale-95 shadow-lg flex items-center justify-center text-black font-black text-xs transition"
          >
            A
          </button>
          <button
            onClick={() => sendCommand("CMD_BACK")}
            className="size-12 rounded-full bg-white/20 active:scale-95 border border-white/20 flex items-center justify-center text-white font-bold text-xs transition"
          >
            B
          </button>
        </div>
      </div>
    </div>
  );
}
