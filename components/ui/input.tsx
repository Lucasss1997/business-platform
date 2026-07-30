import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  description?: string;
  error?: string;
  leftElement?: ReactNode;
  rightElement?: ReactNode;
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      id,
      label,
      description,
      error,
      leftElement,
      rightElement,
      className = "",
      disabled,
      required,
      ...props
    },
    ref,
  ) {
    const generatedId =
      id ??
      props.name ??
      label?.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const descriptionId = description
      ? `${generatedId}-description`
      : undefined;

    const errorId = error ? `${generatedId}-error` : undefined;

    const describedBy = [descriptionId, errorId]
      .filter(Boolean)
      .join(" ");

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={generatedId}
            className="mb-1.5 block text-sm font-semibold text-[var(--text-primary)]"
          >
            {label}

            {required && (
              <span className="ml-1 text-red-600" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}

        {description && (
          <p
            id={descriptionId}
            className="mb-2 text-xs leading-5 text-[var(--text-secondary)]"
          >
            {description}
          </p>
        )}

        <div className="relative">
          {leftElement && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--text-secondary)]">
              {leftElement}
            </div>
          )}

          <input
            ref={ref}
            id={generatedId}
            disabled={disabled}
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy || undefined}
            className={[
              "min-h-11 w-full rounded-xl border bg-white px-3 py-2.5 text-sm",
              "text-[var(--text-primary)] outline-none transition",
              "placeholder:text-slate-400",
              "focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_18%,transparent)]",
              "disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-slate-500",
              error
                ? "border-red-500 focus:border-red-500 focus:ring-red-100"
                : "border-[var(--border)]",
              leftElement ? "pl-10" : "",
              rightElement ? "pr-10" : "",
              className,
            ]
              .filter(Boolean)
              .join(" ")}
            {...props}
          />

          {rightElement && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--text-secondary)]">
              {rightElement}
            </div>
          )}
        </div>

        {error && (
          <p
            id={errorId}
            role="alert"
            className="mt-1.5 text-xs font-medium text-red-600"
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);

export default Input;