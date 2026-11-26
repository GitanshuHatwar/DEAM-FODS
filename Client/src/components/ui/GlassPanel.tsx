import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  animate?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingMap = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export function GlassPanel({
  className,
  animate = true,
  padding = "md",
  children,
  ...props
}: GlassPanelProps) {
  if (!animate) {
    return (
      <div
        className={cn("glass-panel rounded-2xl", paddingMap[padding], className)}
        {...props}
      >
        {children}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={cn("glass-panel rounded-2xl", paddingMap[padding], className)}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </motion.div>
  );
}
