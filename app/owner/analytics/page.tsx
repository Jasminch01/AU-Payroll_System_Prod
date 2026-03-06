"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, MetricCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "sonner";
import { BarChart3, TrendingUp, DollarSign, Plus } from "lucide-react";

export default function OwnerAnalyticsPage() {
    const queryClient = useQueryClient();
    const [salesDate, setSalesDate] = useState(new Date().toISOString().split("T")[0]);
    const [totalSales, setTotalSales] = useState("");
    const [cogs, setCogs] = useState("");
    const [addSalesOpen, setAddSalesOpen] = useState(false);

    const { data: labourData, isLoading } = useQuery({
        queryKey: ["labour-vs-revenue"],
        queryFn: () => apiGet<any>("/analytics/labour-vs-revenue"),
    });

    const { data: salesData = [] } = useQuery({
        queryKey: ["sales"],
        queryFn: () => apiGet<any[]>("/sales"),
    });

    const addSalesMutation = useMutation({
        mutationFn: (data: any) => apiPost("/sales", data),
        onSuccess: () => {
            toast.success("Sales recorded");
            queryClient.invalidateQueries({ queryKey: ["sales", "labour-vs-revenue"] });
            setAddSalesOpen(false);
            setTotalSales("");
            setCogs("");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    return (
        <DashboardLayout
            role="owner"
            pageTitle="Sales & Analytics"
            pageDescription="Track revenue and labour costs"
            actions={
                <Button onClick={() => setAddSalesOpen(!addSalesOpen)}>
                    <Plus size={16} /> Record Sales
                </Button>
            }
        >
            {/* Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <MetricCard
                    title="Labour Cost %"
                    value={labourData ? `${labourData.labour_percentage?.toFixed(1)}%` : "—"}
                    description={labourData ? `Target: ${labourData.threshold_min}% – ${labourData.threshold_max}%` : ""}
                    icon={<TrendingUp size={24} />}
                />
                <MetricCard
                    title="Total Revenue"
                    value={labourData ? `$${labourData.total_revenue?.toLocaleString()}` : "—"}
                    icon={<DollarSign size={24} />}
                />
                <MetricCard
                    title="Total Labour Cost"
                    value={labourData ? `$${labourData.total_labour?.toLocaleString()}` : "—"}
                    icon={<BarChart3 size={24} />}
                />
            </div>

            {/* Add Sales Form */}
            {addSalesOpen && (
                <Card className="mb-6 animate-slide-down">
                    <CardHeader>
                        <CardTitle>Record Daily Sales</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                            <Input label="Date" type="date" value={salesDate} onChange={(e) => setSalesDate(e.target.value)} />
                            <Input label="Total Sales ($)" type="number" placeholder="5000" value={totalSales} onChange={(e) => setTotalSales(e.target.value)} />
                            <Input label="COGS ($)" type="number" placeholder="2000" value={cogs} onChange={(e) => setCogs(e.target.value)} />
                            <Button
                                className="h-10"
                                onClick={() => {
                                    if (!totalSales) return toast.error("Enter total sales amount");
                                    addSalesMutation.mutate({
                                        sales_date: salesDate,
                                        total_sales: parseFloat(totalSales),
                                        cogs: cogs ? parseFloat(cogs) : 0,
                                    });
                                }}
                                loading={addSalesMutation.isPending}
                            >
                                Save
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Sales History */}
            <Card>
                <CardHeader>
                    <CardTitle>Sales History</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
                                    <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Date</th>
                                    <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Total Sales</th>
                                    <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">COGS</th>
                                    <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Gross Profit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {salesData.map((s: any) => (
                                    <tr key={s.Sales_id} className="border-b border-[hsl(var(--border))]">
                                        <td className="px-4 py-3 font-medium">{new Date(s.sales_date).toLocaleDateString("en-AU")}</td>
                                        <td className="px-4 py-3">${s.total_sales?.toLocaleString()}</td>
                                        <td className="px-4 py-3">${s.cogs?.toLocaleString() ?? "—"}</td>
                                        <td className="px-4 py-3 font-medium text-[hsl(var(--success))]">${s.gross_profit?.toLocaleString() ?? "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}
