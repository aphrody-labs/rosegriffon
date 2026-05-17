"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import getCroppedImg from "@/lib/canvasUtils";

interface ImageCropperProps {
  imageSrc: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCropComplete: (croppedBlob: Blob) => void;
  aspectRatio?: number; // Optional aspect ratio (e.g., 16/9, 1, 4/3)
}

export default function ImageCropper({
  imageSrc,
  open,
  onOpenChange,
  onCropComplete,
  aspectRatio = 16 / 9,
}: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropChange = (crop: { x: number; y: number }) => {
    setCrop(crop);
  };

  const onCropCompleteHandler = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (croppedAreaPixels && imageSrc) {
      try {
        const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
        if (croppedImage) {
          onCropComplete(croppedImage);
          onOpenChange(false);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-rg-primary">Recadrer l'image</DialogTitle>
        </DialogHeader>

        <div className="relative w-full h-[400px] bg-black/5 rounded-md overflow-hidden">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspectRatio}
            onCropChange={onCropChange}
            onCropComplete={onCropCompleteHandler}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
          />
        </div>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Zoom</label>
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.1}
              onValueChange={(v) => {
                const val = v[0];
                if (val !== undefined) setZoom(val);
              }}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Rotation</label>
            <Slider
              value={[rotation]}
              min={0}
              max={360}
              step={1}
              onValueChange={(v) => {
                const val = v[0];
                if (val !== undefined) setRotation(val);
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            className="bg-linear-to-r from-rg-primary to-rg-secondary hover:opacity-90 text-white"
          >
            Valider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
