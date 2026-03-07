// app/kiosk/layout.tsx
import React from "react";

export default function KioskLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-[hsl(var(--background))]">
            {children}
        </div>
    );
}
