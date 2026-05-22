"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { BusinessTimezoneProvider } from "@/lib/timezone-context";

export function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000,       // 1 min — don't refetch within 1 min
                        gcTime: 5 * 60 * 1000,       // 5 min — keep unused data in memory
                        refetchOnWindowFocus: false,  // Don't refetch on tab focus
                        refetchOnReconnect: true,     // But do refetch on reconnect
                        retry: 1,
                    },
                    mutations: {
                        retry: 0,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            <BusinessTimezoneProvider>
                {children}
            </BusinessTimezoneProvider>
        </QueryClientProvider>
    );
}
