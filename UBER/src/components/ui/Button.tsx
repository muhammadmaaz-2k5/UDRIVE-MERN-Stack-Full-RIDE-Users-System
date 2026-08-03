import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  fullWidth,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    primary:
      "bg-udrive-700 text-white hover:bg-udrive-800 shadow-sm hover:shadow-md",
    secondary: "bg-slate-900 text-white hover:bg-slate-800 shadow-sm",
    ghost: "text-slate-700 hover:bg-slate-100",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
    outline:
      "border-2 border-slate-200 text-slate-700 hover:border-udrive-400 hover:text-udrive-700 bg-white",
  };
  const sizes = {
    sm: "text-sm px-3.5 py-2",
    md: "text-sm px-5 py-3",
    lg: "text-base px-6 py-3.5",
  };
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${
        fullWidth ? "w-full" : ""
      } ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
