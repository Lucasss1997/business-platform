import Link from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "danger"
  | "ghost";

type ButtonSize = "sm" | "md" | "lg";

type SharedButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  className?: string;
};

type StandardButtonProps = SharedButtonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

type LinkButtonProps = SharedButtonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
  };

export type ButtonProps = StandardButtonProps | LinkButtonProps;

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent)] text-white hover:brightness-95 focus-visible:ring-[var(--accent)]",
  secondary:
    "bg-[#101827] text-white hover:bg-[#182338] focus-visible:ring-[#101827]",
  outline:
   "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-soft)] focus-visible:ring-[var(--accent)]",
  danger:
    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600",
  ghost:
    "bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-soft)] focus-visible:ring-[var(--accent)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 py-1.5 text-xs",
  md: "min-h-10 px-4 py-2 text-sm",
  lg: "min-h-12 px-5 py-3 text-base",
};

function buildClassName({
  variant,
  size,
  fullWidth,
  className,
}: {
  variant: ButtonVariant;
  size: ButtonSize;
  fullWidth: boolean;
  className?: string;
}) {
  return [
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold",
    "transition duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60",
    variantClasses[variant],
    sizeClasses[size],
    fullWidth ? "w-full" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

function LoadingSpinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}

function isLinkButton(props: ButtonProps): props is LinkButtonProps {
  return typeof props.href === "string";
}

export default function Button(props: ButtonProps) {
  const variant = props.variant ?? "primary";
  const size = props.size ?? "md";
  const loading = props.loading ?? false;
  const fullWidth = props.fullWidth ?? false;

  const combinedClassName = buildClassName({
    variant,
    size,
    fullWidth,
    className: props.className,
  });

  const content = (
    <>
      {loading ? <LoadingSpinner /> : props.leftIcon}

      <span>{props.children}</span>

      {!loading && props.rightIcon}
    </>
  );

  if (isLinkButton(props)) {
    const {
      href,
      variant: _variant,
      size: _size,
      loading: _loading,
      leftIcon: _leftIcon,
      rightIcon: _rightIcon,
      fullWidth: _fullWidth,
      className: _className,
      children: _children,
      ...linkProps
    } = props;

    return (
      <Link
        href={href}
        className={combinedClassName}
        aria-disabled={loading || undefined}
        {...linkProps}
      >
        {content}
      </Link>
    );
  }

  const {
    variant: _variant,
    size: _size,
    loading: _loading,
    leftIcon: _leftIcon,
    rightIcon: _rightIcon,
    fullWidth: _fullWidth,
    className: _className,
    children: _children,
    disabled,
    type,
    ...buttonProps
  } = props;

  const buttonType: "button" | "submit" | "reset" = type ?? "button";

  return (
    <button
      type={buttonType}
      disabled={disabled || loading}
      aria-busy={loading}
      className={combinedClassName}
      {...buttonProps}
    >
      {content}
    </button>
  );
}