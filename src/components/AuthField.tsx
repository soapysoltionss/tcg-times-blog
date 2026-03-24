"use client";

import { InputHTMLAttributes, forwardRef } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  /** Shown on the right side of the label row */
  labelRight?: React.ReactNode;
  /** Delay index for staggered animation */
  index?: number;
};

const AuthField = forwardRef<HTMLInputElement, Props>(
  ({ label, error, hint, labelRight, index = 0, ...props }, ref) => {
    const delay = index * 75;
    return (
      <div
        className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-400"
        style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
      >
        <div className="flex items-baseline justify-between">
          <label className="label-upper text-[var(--text-muted)] text-[10px]">{label}</label>
          {labelRight && (
            <span className="text-[10px] text-[var(--text-muted)]">{labelRight}</span>
          )}
        </div>
        <input
          ref={ref}
          {...props}
          className={`w-full px-4 py-3 border text-sm bg-transparent text-[var(--foreground)]
            placeholder:text-[var(--text-muted)] focus:outline-none transition-colors
            ${
              error
                ? "border-red-500 focus:border-red-500"
                : "border-[var(--border)] focus:border-[var(--border-strong)]"
            }
            ${props.className ?? ""}`}
        />
        {error && (
          <p className="text-xs text-red-500 animate-in fade-in duration-200">{error}</p>
        )}
        {hint && !error && (
          <p className="text-xs text-[var(--text-muted)]">{hint}</p>
        )}
      </div>
    );
  }
);

AuthField.displayName = "AuthField";
export default AuthField;
