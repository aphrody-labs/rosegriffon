import Image from "next/image";
import type React from "react";

type FusionBlockProps = {
  isImageLeft: boolean;
  image?: string;
  children: React.ReactNode;
  imageStyle?: React.CSSProperties;
  imageOverlay?: React.ReactNode;
  isPriority?: boolean;
};

export default function FusionBlock({
  isImageLeft,
  image,
  children,
  imageStyle,
  imageOverlay,
  isPriority = false,
}: FusionBlockProps) {
  const imageUrl = image || "https://placehold.co/600x400";

  const imageBlock = (
    <div className="w-full md:w-1/2 h-[240px] sm:h-[280px] md:h-[320px] lg:h-[380px] rounded-2xl md:rounded-none overflow-hidden relative bg-gray-100 flex items-center justify-center group-hover:shadow-xl transition-shadow duration-300">
      <Image
        src={imageUrl}
        alt="Description Rose Griffon"
        fill
        className="object-center object-cover group-hover:scale-110 transition-transform duration-500"
        sizes="(max-width: 768px) 100vw, 50vw"
        style={imageStyle}
        priority={isPriority}
        loading={isPriority ? undefined : "lazy"}
        unoptimized
      />
      {imageOverlay && (
        <div className="absolute inset-0 flex items-center justify-center">{imageOverlay}</div>
      )}
    </div>
  );

  const contentBlock = (
    <div className="w-full md:w-1/2 bg-white dark:bg-gray-800 p-5 pt-0 sm:p-6 sm:pt-0 md:p-7 md:pt-0 lg:p-8 lg:pt-0 xl:p-10 xl:pt-0 flex items-center rounded-2xl md:rounded-none shadow-lg group-hover:shadow-xl transition-shadow duration-300 overflow-hidden">
      {children}
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row w-full gap-3 sm:gap-4 md:gap-0 group hover:shadow-2xl transition-all duration-300 md:min-h-[320px] lg:min-h-[380px] rounded-2xl md:rounded-3xl overflow-hidden">
      {/* Mobile: Image always on top */}
      <div className="contents md:hidden">
        {imageBlock}
        {contentBlock}
      </div>

      {/* Desktop: Respect isImageLeft */}
      <div className="contents max-md:hidden">
        {isImageLeft ? (
          <>
            {imageBlock}
            {contentBlock}
          </>
        ) : (
          <>
            {contentBlock}
            {imageBlock}
          </>
        )}
      </div>
    </div>
  );
}
