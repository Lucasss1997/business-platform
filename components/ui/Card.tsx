import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
};

type CardSectionProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6 lg:p-8",
};

function CardRoot({
  children,
  padding = "none",
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={[
        "overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        paddingClasses[padding],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

function CardHeader({
  children,
  className = "",
  ...props
}: CardSectionProps) {
  return (
    <div
      className={[
        "border-b border-[var(--border)] px-5 py-4 lg:px-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

function CardBody({
  children,
  className = "",
  ...props
}: CardSectionProps) {
  return (
    <div
      className={["px-5 py-5 lg:px-6", className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

function CardFooter({
  children,
  className = "",
  ...props
}: CardSectionProps) {
  return (
    <div
      className={[
        "border-t border-[var(--border)] bg-[var(--surface-muted)] px-5 py-4 lg:px-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter,
});

export default Card;