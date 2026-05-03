"use client";

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

interface RealtimeInvalidatorOptions {
    table: string;
    queryKeys: string[][];
    filter?: string;
    event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
}

/**
 * Custom hook to invalidate React Query caches when Supabase table changes
 */
export function useRealtimeInvalidator(options: RealtimeInvalidatorOptions | RealtimeInvalidatorOptions[]) {
    const queryClient = useQueryClient();
    const configs = Array.isArray(options) ? options : [options];

    useEffect(() => {
        const supabase = createClient();
        const channelId = `realtime-invalidator-${Math.random().toString(36).substr(2, 9)}`;
        const channel = supabase.channel(channelId);

        configs.forEach((config) => {
            channel.on(
                'postgres_changes',
                {
                    event: config.event || '*',
                    schema: 'public',
                    table: config.table,
                    filter: config.filter
                },
                (payload) => {
                    config.queryKeys.forEach(key => {
                        queryClient.invalidateQueries({ queryKey: key });
                    });
                }
            );
        });

        channel.subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [configs, queryClient]);
}
