"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useState } from "react";

interface SafeImageProps extends ImageProps {
  zukanHash?: string;
  /** URL de l'image placeholder quand toutes les tentatives échouent. Par défaut : /placeholder-chara.webp */
  fallbackSrc?: string;
}

/** Placeholder par défaut pour les personnages sans image */
const DEFAULT_PLACEHOLDER = "/ie.webp";

export function SafeImage({ src, zukanHash, alt, fallbackSrc, ...props }: SafeImageProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [fallbackStage, setFallbackStage] = useState(0);
  const [isFailed, setIsFailed] = useState(false);

  useEffect(() => {
    setImgSrc(src);
    setFallbackStage(0);
    setIsFailed(false);
  }, [src]);

  const handleError = () => {
    const nextStage = fallbackStage + 1;
    setFallbackStage(nextStage);

    if (nextStage === 1 && zukanHash) {
      // Fallback 1 : essayer le zukan CDN avec .png
      const cleanHash = zukanHash.startsWith("/") ? zukanHash.substring(1) : zukanHash;
      setImgSrc(`https://dxi4wb638ujep.cloudfront.net/1/${cleanHash}.png`);
      return;
    }

    if (nextStage <= 2) {
      // Fallback 2 : retirer le suffixe _5000/_5100 du face URL
      const srcStr = typeof src === "string" ? src : "";
      const suffixMatch = srcStr.match(/\/face\/(.+?)_\d{4}_l_/);
      if (suffixMatch) {
        const baseUrl = srcStr.replace(/_\d{4}_l_.*$/, (m) => m.replace(/_\d{4}/, ""));
        setImgSrc(baseUrl);
        return;
      }
    }

    // Toutes les tentatives ont échoué → placeholder
    setIsFailed(true);
    setImgSrc(fallbackSrc || DEFAULT_PLACEHOLDER);
  };

  return (
    <Image
      {...props}
      src={imgSrc}
      alt={alt}
      onError={isFailed ? undefined : handleError}
      unoptimized={isFailed}
    />
  );
}
