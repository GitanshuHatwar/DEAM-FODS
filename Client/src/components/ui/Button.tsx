import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "mint" | "ghost" | "danger" | "warning";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[#2E5D4B] text-white hover:bg-[#3F7A64] active:scale-[0.99] shadow-sm focus-visible:ring-2 focus-visible:ring-[#2E5D4B]/30",
  secondary:
    "bg-white text-[#0F172A] border border-[#E5E7EB] hover:bg-[#F8F6F3] active:scale-[0.99] shadow-card",
  mint: "bg-[#E8F3EF] text-[#2E5D4B] border border-[#2E5D4B]/15 hover:bg-[#d9ece5] active:scale-[0.99]",
  ghost:
    "bg-transparent text-[#6B7280] hover:bg-[#E8F3EF]/70 hover:text-[#2E5D4B]",
  danger:
    "bg-[#DC6464] text-white hover:bg-[#c85555] active:scale-[0.99] shadow-sm",
  warning:
    "bg-[#D99A45] text-white hover:bg-[#c68937] active:scale-[0.99] shadow-sm",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-11 px-5 text-sm rounded-xl gap-2",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-55 select-none",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  },
);

Button.displayName = "Button";
