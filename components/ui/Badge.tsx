import type { HTMLAttributes, ReactNode } from "react";

type BadgeVariant =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
};

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  primary:
    "bg-emerald-50 text-emerald-800 ring-emerald-200",
  success:
    "bg-green-50 text-green-800 ring-green-200",
  warning:
    "bg-amber-50 text-amber-800 ring-amber-200",
  danger:
    "bg-red-50 text-red-800 ring-red-200",
  info:
    "bg-blue-50 text-blue-800 ring-blue-200",
};

const dotClasses: Record<BadgeVariant, string> = {
  neutral: "bg-slate-500",
  primary: "bg-[var(--accent)]",
  success: "bg-green-600",
  warning: "bg-amber-500",
  danger: "bg-red-600",
  info: "bg-blue-600",
};

export default function Badge({
  children,
  variant = "neutral",
  dot = false,
  className = "",
  ...props
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1",
        "text-xs font-semibold ring-1 ring-inset",
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={[
            "h-1.5 w-1.5 rounded-full",
            dotClasses[variant],
          ].join(" ")}
        />
      )}

      {children}
    </span>
  );
}