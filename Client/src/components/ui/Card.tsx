import React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "white" | "warm" | "beige";
  padding?: "none" | "sm" | "md" | "lg";
}

const variantMap: Record<NonNullable<CardProps["variant"]>, string> = {
  white: "bg-white border border-[#E5E7EB] shadow-card",
  warm: "bg-[#F8F6F3] border border-[#E5E7EB] shadow-card",
  beige: "bg-[#F4ECE1]/70 border border-[#E5E7EB] shadow-card",
};

const paddingMap: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export function Card({
  className,
  variant = "white",
  padding = "md",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl transition-shadow duration-200",
        variantMap[variant],
        paddingMap[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-start justify-between gap-4 mb-4", className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-base font-semibold tracking-tight text-[#0F172A]",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm text-[#6B7280] leading-relaxed", className)}
      {...props}
    />
  );
}
