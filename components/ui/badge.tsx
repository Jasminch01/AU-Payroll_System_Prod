import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
    {
        variants: {
            variant: {
                default:
                    "bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))]",
                success:
                    "bg-[hsl(var(--success-light))] text-[hsl(var(--success))]",
                warning:
                    "bg-[hsl(var(--warning-light))] text-[hsl(var(--warning))]",
                danger:
                    "bg-[hsl(var(--danger-light))] text-[hsl(var(--danger))]",
                secondary:
                    "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
                outline:
                    "border border-[hsl(var(--border))] text-[hsl(var(--foreground))]",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    );
}

/**
 * Helper: Map common status strings to badge variants
 */
function StatusBadge({ status }: { status: string }) {
    const statusMap: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
        active: { variant: "success", label: "Active" },
        inactive: { variant: "secondary", label: "Inactive" },
        invited: { variant: "default", label: "Invited" },
        approved: { variant: "success", label: "Approved" },
        pending: { variant: "warning", label: "Pending" },
        rejected: { variant: "danger", label: "Rejected" },
        draft: { variant: "secondary", label: "Draft" },
        paid: { variant: "success", label: "Paid" },
        failed: { variant: "danger", label: "Failed" },
        synced: { variant: "success", label: "Synced" },
        published: { variant: "success", label: "Published" },
        cancelled: { variant: "secondary", label: "Cancelled" },
        confirmed: { variant: "success", label: "Confirmed" },
        completed: { variant: "success", label: "Completed" },
        insert: { variant: "success", label: "Created" },
        update: { variant: "warning", label: "Updated" },
        delete: { variant: "danger", label: "Deleted" },
        clock_in: { variant: "success", label: "Clock In" },
        clock_out: { variant: "default", label: "Clock Out" },
        override: { variant: "warning", label: "Override" },
    };

    const config = statusMap[status?.toLowerCase()] || { variant: "secondary" as const, label: status };

    return <Badge variant={config.variant}>{config.label}</Badge>;
}

export { Badge, badgeVariants, StatusBadge };
