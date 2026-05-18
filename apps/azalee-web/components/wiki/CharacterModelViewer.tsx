"use client";

import { Box, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Button } from "@rose-griffon/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@rose-griffon/ui";
import { getCharacterModel360Url } from "@/lib/images";

interface CharacterModelViewerProps {
  hash: string;
  name?: string;
  className?: string;
}

const TOTAL_FRAMES = 8;

export default function CharacterModelViewer({ hash, name }: CharacterModelViewerProps) {
  const [frame, setFrame] = useState(0);
  const [isFullBody, setIsFullBody] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startFrame, setStartFrame] = useState(0);
  const [loading, setLoading] = useState(true);

  // Preload images
  useEffect(() => {
    // Basic preloading logic
    const preload = (f: number, full: boolean) => {
      const img = new window.Image();
      img.src = getCharacterModel360Url(hash, f, full);
    };

    // Preload current mode frames
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      preload(i, isFullBody);
    }
  }, [hash, isFullBody]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setStartX(e.clientX);
    setStartFrame(frame);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startX;
    // Sensitivity: 1 frame per 10px
    const frameDelta = Math.floor(deltaX / 10);

    // Calculate new frame (wrapping around)
    let newFrame = (startFrame - frameDelta) % TOTAL_FRAMES;
    if (newFrame < 0) newFrame += TOTAL_FRAMES;

    setFrame(newFrame);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const currentUrl = getCharacterModel360Url(hash, frame, isFullBody);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-on-surface-variant hover:text-primary"
        >
          <Box className="size-4" />
          <span className="sr-only">Voir le modèle 3D de {name}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] bg-surface p-0 overflow-hidden border-outline-variant rounded-xl sm:rounded-2xl">
        <DialogHeader className="p-4 bg-surface-container absolute top-0 w-full z-10 bg-opacity-80 backdrop-blur-sm border-b border-outline-variant/20">
          <DialogTitle className="text-on-surface flex items-center gap-2 text-base">
            <Box className="size-4 text-primary" />
            {name || "Modèle 3D"}
          </DialogTitle>
        </DialogHeader>

        <div
          className="aspect-[3/4] relative bg-[url(/fond.webp)] bg-cover bg-center cursor-ew-resize touch-none select-none transition-cursor"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <div className="absolute inset-0 flex items-center justify-center p-8">
            {currentUrl && (
              <Image
                src={currentUrl}
                alt={`${name} 3D View`}
                fill
                className="object-contain drop-shadow-xl"
                priority
                draggable={false}
                onLoadingComplete={() => setLoading(false)}
                unoptimized
              />
            )}
          </div>

          {/* Loading Indicator */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface/50">
              <div className="animate-spin rounded-full size-8 border-b-2 border-primary" />
            </div>
          )}

          {/* Controls Overlay */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
            <div className="bg-surface-container-high/80 backdrop-blur rounded-full p-1 flex gap-1 border border-outline-variant shadow-sm">
              <Button
                variant={!isFullBody ? "secondary" : "ghost"}
                size="icon"
                className="size-8 rounded-full"
                onClick={() => setIsFullBody(false)}
                title="Portrait"
              >
                <ZoomIn className="size-4" />
              </Button>
              <Button
                variant={isFullBody ? "secondary" : "ghost"}
                size="icon"
                className="size-8 rounded-full"
                onClick={() => setIsFullBody(true)}
                title="Plein pied"
              >
                <ZoomOut className="size-4" />
              </Button>
              <div className="w-px bg-outline-variant my-1" />
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-full"
                onClick={() => setFrame((f) => (f + 1) % TOTAL_FRAMES)}
              >
                <RotateCw className="size-4" />
              </Button>
            </div>
          </div>

          {/* Hint */}
          <div className="absolute top-20 left-0 right-0 text-center pointer-events-none opacity-0 animate-[fadeIn_3s_ease-in-out_2s_forwards]">
            <span className="text-xs text-on-surface-variant/50 bg-surface/30 px-2 py-1 rounded">
              Glissez pour tourner
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
