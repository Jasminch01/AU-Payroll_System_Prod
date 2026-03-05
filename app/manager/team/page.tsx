"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { DataTable, Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/badge";
import { apiGet } from "@/lib/api-client";
import { Users } from "lucide-react";

export default function ManagerTeamPage() {
    const { data: employees = [], isLoading } = useQuery({
        queryKey: ["employees"],
        queryFn: () => apiGet<any[]>("/employees"),
    });

    const columns: Column<any>[] = [
        {
            key: "name",
            label: "Name",
            sortable: true,
            render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] text-sm font-bold">
                        {row.first_name?.[0]}{row.last_name?.[0]}
                    </div>
                    <div>
                        <p className="font-medium">{row.first_name} {row.last_name}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{row.email}</p>
                    </div>
                </div>
            ),
        },
        { key: "role_title", label: "Role", sortable: true },
        {
            key: "status",
            label: "Status",
            render: (row) => <StatusBadge status={row.status} />,
        },
    ];

    return (
        <DashboardLayout role="manager" pageTitle="My Team" pageDescription="View your team members">
            <DataTable
                columns={columns}
                data={employees}
                searchable
                searchKeys={["first_name", "last_name", "email"]}
                searchPlaceholder="Search team..."
                emptyMessage="No team members"
                emptyIcon={<Users size={40} />}
                loading={isLoading}
            />
        </DashboardLayout>
    );
}
