"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, InputProps } from "./input";
import { cn } from "@/lib/utils";

const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, autoComplete = "current-password", name = "password", ...props }, ref) => {
        const [showPassword, setShowPassword] = React.useState(false);

        return (
            <Input
                {...props}
                ref={ref}
                type={showPassword ? "text" : "password"}
                name={name}
                autoComplete={autoComplete}
                className={cn("pr-10", className)}
                suffix={
                    <button
                        type="button"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        tabIndex={-1}
                        onClick={() => setShowPassword((v) => !v)}
                        className="flex items-center justify-center focus:outline-none"
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                }
            />
        );
    }
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };