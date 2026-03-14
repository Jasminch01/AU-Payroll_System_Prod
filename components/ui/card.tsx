import * as React from "react";
import { cn } from "@/lib/utils";

/* ============================================
   Card — The primary surface container
   ============================================ */

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(
                "rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))]",
                className
            )}

            {...props}
        />
    )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
    )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ className, ...props }, ref) => (
        <h3 ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
    )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => (
        <p ref={ref} className={cn("text-sm text-[hsl(var(--muted-foreground))]", className)} {...props} />
    )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
    )
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
    )
);
CardFooter.displayName = "CardFooter";

/* ============================================
   MetricCard — For dashboard KPI display
   ============================================ */

interface MetricCardProps {
    title: string;
    value: string | number;
    description?: string;
    icon?: React.ReactNode;
    trend?: { value: number; label: string };
    className?: string;
}

function MetricCard({ title, value, description, icon, trend, className }: MetricCardProps) {
    return (
        <Card className={cn("animate-slide-up", className)}>
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{title}</p>
                        <p className="text-3xl font-bold tracking-tight">{value}</p>
                        {description && (
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">{description}</p>
                        )}
                        {trend && (
                            <div className="flex items-center gap-1">
                                <span
                                    className={cn(
                                        "text-xs font-medium",
                                        trend.value >= 0 ? "text-[hsl(var(--success))]" : "text-[hsl(var(--danger))]"
                                    )}
                                >
                                    {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%
                                </span>
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">{trend.label}</span>
                            </div>
                        )}
                    </div>
                    {icon && (
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))]">
                            {icon}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, MetricCard };
