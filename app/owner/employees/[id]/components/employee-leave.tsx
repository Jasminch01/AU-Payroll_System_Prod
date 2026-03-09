"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export function EmployeeLeave({ employeeId }: { employeeId: string }) {
    const { data: records, isLoading, error } = useQuery({
        queryKey: ["employee-leave", employeeId],
        queryFn: () => apiGet<any>(`/leave`),
        enabled: !!employeeId,
    });

    if (isLoading) return <div className="p-4">Loading leave...</div>;
    if (error) return <div className="p-4 text-red-500">Failed to load leave records</div>;

    const leaveRequests = records?.requests?.filter((r: any) => r.employee_id === employeeId) || [];
    const balances = records?.balances?.filter((b: any) => b.employee_id === employeeId) || [];

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Leave Balances</CardTitle>
                </CardHeader>
                <CardContent>
                    {balances.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {balances.map((b: any) => (
                                <div key={b.balance_id} className="p-4 border rounded-lg bg-[hsl(var(--muted))]/10">
                                    <h4 className="font-semibold mb-2">{b.LeaveType?.name || "Leave"}</h4>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-[hsl(var(--muted-foreground))]">Balance</span>
                                        <span className="font-medium text-[hsl(var(--success))]">{b.accrued_hours - b.taken_hours} hrs</span>
                                    </div>
                                    <div className="flex justify-between text-xs mt-1">
                                        <span className="text-[hsl(var(--muted-foreground))]">Accrued</span>
                                        <span>{b.accrued_hours} hrs</span>
                                    </div>
                                    <div className="flex justify-between text-xs mt-1">
                                        <span className="text-[hsl(var(--muted-foreground))]">Taken</span>
                                        <span>{b.taken_hours} hrs</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-4 text-[hsl(var(--muted-foreground))]">
                            No leave balances found.
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Leave History</CardTitle>
                </CardHeader>
                <CardContent>
                    {leaveRequests.length > 0 ? (
                        <div className="space-y-4">
                            {leaveRequests.map((req: any) => (
                                <div key={req.leave_request_id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 border rounded-lg bg-[hsl(var(--muted))]/10">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-semibold">{req.LeaveType?.name}</p>
                                            <Badge variant={req.status === 'approved' ? 'default' : req.status === 'rejected' ? 'danger' : 'secondary'}>
                                                {req.status}
                                            </Badge>
                                        </div>
                                        <p className="text-sm">
                                            {format(new Date(req.start_date), "MMM d, yyyy")} - {format(new Date(req.end_date), "MMM d, yyyy")}
                                        </p>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                            {req.total_hours} hrs &bull; {req.reason}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-[hsl(var(--muted-foreground))]">
                            No leave requests found.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
