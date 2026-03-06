"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    error?: string;
    label?: string;
    hint?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, error, label, hint, id, ...props }, ref) => {
        const inputId = id || React.useId();

        return (
            <div className="space-y-1.5">
                {label && (
                    <label
                        htmlFor={inputId}
                        className="text-sm font-medium text-[hsl(var(--foreground))]"
                    >
                        {label}
                    </label>
                )}
                <input
                    type={type}
                    id={inputId}
                    className={cn(
                        "flex h-10 w-full rounded-lg border bg-transparent px-3 py-2 text-sm transition-all duration-150",
                        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
                        "placeholder:text-[hsl(var(--muted-foreground))]",
                        "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20 focus:border-[hsl(var(--brand))]",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        error
                            ? "border-[hsl(var(--danger))] focus:ring-[hsl(var(--danger))]/20 focus:border-[hsl(var(--danger))]"
                            : "border-[hsl(var(--input))]",
                        className
                    )}
                    ref={ref}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
                    {...props}
                />
                {error && (
                    <p id={`${inputId}-error`} className="text-xs text-[hsl(var(--danger))] mt-1">
                        {error}
                    </p>
                )}
                {hint && !error && (
                    <p id={`${inputId}-hint`} className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                        {hint}
                    </p>
                )}
            </div>
        );
    }
);
Input.displayName = "Input";

export { Input };
