"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";

export interface AuthProfile {
    user_id: string;
    email: string;
    role: "owner" | "manager" | "employee";
    first_name: string;
    last_name: string;
    business_id: string;
    business?: {
        business_id: string;
        business_name: string;
        timezone: string | null;
        state: string | null;
        [key: string]: unknown;
    };
    employee_id?: string;
    status?: string;
}

/**
 * Client-side hook to get the currently authenticated user.
 * Uses TanStack Query so data is cached & shared across components.
 */
export function useAuth() {
    const {
        data: user,
        isLoading,
        error,
    } = useQuery<AuthProfile>({
        queryKey: ["auth-me"],
        queryFn: () => apiGet<AuthProfile>("/auth/me"),
        staleTime: 5 * 60 * 1000, // 5 min
        retry: false,
    });

    return {
        user: user ?? null,
        isLoading,
        isAuthenticated: !!user,
        error,
        fullName: user ? `${user.first_name} ${user.last_name}`.trim() : "",
        initials: user
            ? `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase()
            : "U",
    };
}
