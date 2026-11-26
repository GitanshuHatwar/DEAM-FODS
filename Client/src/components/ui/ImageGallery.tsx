import { useState } from "react";
import { Maximize2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export function ImageGallery({
  images,
  emptyLabel = "No photos attached",
}: {
  images: string[];
  emptyLabel?: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (!images || images.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#E5E7EB] bg-[#F8F6F3] px-4 py-5 text-center text-xs text-[#6B7280]">
        {emptyLabel}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((src, idx) => (
          <button
            key={`${src}-${idx}`}
            type="button"
            onClick={() => setActiveIndex(idx)}
            className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F8F6F3] text-left focus-visible:ring-2 focus-visible:ring-[#2E5D4B]"
          >
            <img
              src={src}
              alt={`Attachment ${idx + 1}`}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
            <span className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-[#0F172A] opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
              <Maximize2 className="h-3.5 w-3.5" />
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {activeIndex !== null && (
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0F172A]/80 p-4 backdrop-blur-sm"
            onClick={() => setActiveIndex(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[88vh] max-w-4xl overflow-hidden rounded-2xl border border-white/20 bg-white p-2 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setActiveIndex(null)}
                aria-label="Close lightbox"
                className="absolute right-4 top-4 z-10 rounded-full bg-white/90 p-2 text-[#0F172A] shadow-md hover:bg-white"
              >
                <X className="h-4 w-4" />
              </button>
              <img
                src={images[activeIndex]}
                alt={`Full preview ${activeIndex + 1}`}
                className="max-h-[80vh] w-auto rounded-xl object-contain"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
