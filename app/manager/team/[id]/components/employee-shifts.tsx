"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

export function EmployeeShifts({ employeeId }: { employeeId: string }) {
    const { data: shifts, isLoading, error } = useQuery({
        queryKey: ["employee-shifts", employeeId],
        queryFn: () => apiGet<any[]>(`/shift?employee_id=${employeeId}`),
        enabled: !!employeeId,
    });

    if (isLoading) return <div className="p-4">Loading shifts...</div>;
    if (error) return <div className="p-4 text-red-500">Failed to load shifts</div>;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Assigned Shifts</CardTitle>
            </CardHeader>
            <CardContent>
                {shifts && shifts.length > 0 ? (
                    <div className="space-y-4">
                        {shifts.map((shift) => (
                            <div key={shift.shift_id} className="flex justify-between items-center p-4 border rounded-lg bg-[hsl(var(--muted))]/10">
                                <div>
                                    <p className="font-semibold">{format(new Date(shift.shift_date), "EEEE, MMM d, yyyy")}</p>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))] capitalize">{shift.shift_type} ({shift.status})</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-medium text-sm">
                                        {format(new Date(shift.start_time), "h:mm a")} - {format(new Date(shift.end_time), "h:mm a")}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6 text-[hsl(var(--muted-foreground))]">
                        No shifts currently assigned to this employee.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
