"use client";

/**
 * BusinessTimezoneContext
 *
 * Provides the current business timezone to all client components.
 * Sources the timezone from the authenticated user's Business record,
 * which is already included in the /api/auth/me response.
 *
 * Usage:
 *   const { businessTimezone } = useBusinessTimezone();
 *
 * The timezone string is a valid IANA timezone (e.g. "Australia/Brisbane").
 * Falls back to "Australia/Sydney" if the business has no timezone set.
 */

import React, { createContext, useContext, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { resolveTimezone, FALLBACK_TIMEZONE } from "@/lib/timezone-utils";

interface BusinessTimezoneContextValue {
  /** IANA timezone string for this business, e.g. "Australia/Brisbane" */
  businessTimezone: string;
  /** Whether the timezone is still loading (auth is loading) */
  isLoading: boolean;
}

const BusinessTimezoneContext = createContext<BusinessTimezoneContextValue>({
  businessTimezone: FALLBACK_TIMEZONE,
  isLoading: false,
});

/**
 * Provider — wrap your app/layout with this so all components have access.
 */
export function BusinessTimezoneProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();

  const businessTimezone = useMemo(() => {
    const rawTz = (user?.business as any)?.timezone ?? null;
    return resolveTimezone(rawTz);
  }, [user]);

  return (
    <BusinessTimezoneContext.Provider value={{ businessTimezone, isLoading }}>
      {children}
    </BusinessTimezoneContext.Provider>
  );
}

/**
 * Hook to access the current business timezone in any client component.
 *
 * @example
 * const { businessTimezone } = useBusinessTimezone();
 * const display = formatInTimezone(timestamp, { hour: '2-digit', minute: '2-digit', hour12: true }, businessTimezone);
 */
export function useBusinessTimezone(): BusinessTimezoneContextValue {
  return useContext(BusinessTimezoneContext);
}
