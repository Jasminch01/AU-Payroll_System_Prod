"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, InputProps } from "./input";
import { cn } from "@/lib/utils";

const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, autoComplete = "current-password", name = "password", ...props }, ref) => {
        const [showPassword, setShowPassword] = React.useState(false);

        return (
            <div className="relative">
                {/*
                 * FIX: Toggling type="password" ↔ type="text" destroys the browser's
                 * autofill association — the browser treats it as a new field and drops
                 * the saved credential. Always keep type="password" and use CSS
                 * -webkit-text-security to visually toggle between dots and plain text.
                 */}
                <Input
                    {...props}
                    ref={ref}
                    type="password"
                    name={name}
                    autoComplete={autoComplete}
                    className={cn("pr-10", className)}
                    style={
                        showPassword
                            ? { WebkitTextSecurity: "none" } as React.CSSProperties
                            : { WebkitTextSecurity: "disc" } as React.CSSProperties
                    }
                />
                <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-[38px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>
        );
    }
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };