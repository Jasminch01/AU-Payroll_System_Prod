"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileQuestion } from "lucide-react";

export default function NotFound() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] p-6">
            <div className="text-center space-y-6 max-w-md">
                <div className="flex justify-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--muted))]">
                        <FileQuestion size={40} className="text-[hsl(var(--muted-foreground))]" />
                    </div>
                </div>
                <h1 className="text-4xl font-bold">404</h1>
                <p className="text-[hsl(var(--muted-foreground))]">
                    The page you&apos;re looking for doesn&apos;t exist or has been moved.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Link href="/">
                        <Button variant="outline" size="lg">
                            <ArrowLeft size={16} /> Home
                        </Button>
                    </Link>
                    <Link href="/login">
                        <Button size="lg">
                            Sign in to Dashboard
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
