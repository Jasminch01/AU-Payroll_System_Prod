"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export function EmployeeTimesheets({ employeeId }: { employeeId: string }) {
    const { data: timesheets, isLoading, error } = useQuery({
        queryKey: ["employee-timesheets", employeeId],
        queryFn: () => apiGet<any[]>(`/timesheets/employee/${employeeId}`),
        enabled: !!employeeId,
    });

    if (isLoading) return <div className="p-4">Loading timesheets...</div>;
    if (error) return <div className="p-4 text-red-500">Failed to load timesheets</div>;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Timesheet Records</CardTitle>
            </CardHeader>
            <CardContent>
                {timesheets && timesheets.length > 0 ? (
                    <div className="space-y-4">
                        {timesheets.map((ts) => (
                            <div key={ts.timesheet_id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 border rounded-lg bg-[hsl(var(--muted))]/10">
                                <div>
                                    <p className="font-semibold">{format(new Date(ts.date), "EEEE, MMM d, yyyy")}</p>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                        {ts.actual_hours !== null ? `${ts.actual_hours.toFixed(2)} hrs` : "Missing punch"}&nbsp;&bull;&nbsp;
                                        {ts.actual_start ? format(new Date(ts.actual_start), "h:mm a") : "--"} - {ts.actual_end ? format(new Date(ts.actual_end), "h:mm a") : "--"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right sm:mr-4">
                                        {ts.gross_pay !== null && ts.gross_pay !== undefined && (
                                            <p className="font-medium text-sm">Gross: ${ts.gross_pay.toFixed(2)}</p>
                                        )}
                                        {ts.rate_type && <p className="text-xs text-[hsl(var(--muted-foreground))]">{ts.rate_type.replace(/_/g, " ")}</p>}
                                    </div>
                                    <Badge variant={(ts.status === 'approved' || ts.status === 'paid') ? 'default' : ts.status === 'rejected' ? 'danger' : 'secondary'}>
                                        {ts.status || "pending"}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6 text-[hsl(var(--muted-foreground))]">
                        No timesheet records found for this employee.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
