"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "@/lib/api-client";
import { getShiftTypeFromTime, calculateShiftDuration, formatDurationHours } from "@/lib/shift-utils";
import { EmployeeSearchPicker } from "@/components/roster/employee-search-picker";
import { useEffect } from "react";
import { toast } from "sonner";
import { Plus, ChevronLeft, ChevronRight, Clock, Trash2, CheckCircle2, FileText, RefreshCcw, Copy, Bell, CalendarDays, Search, Filter, ChevronsLeft, ChevronsRight, GripVertical, MoreHorizontal, Users, ChevronDown, ArrowUpDown, ArrowDownAZ, ArrowDownZA, Settings2, ChevronUp, Info, X, ClipboardList, Check, AlertTriangle } from "lucide-react";
import { Reorder, AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { createClient } from "@/lib/supabase/client";
import {
    Popover, PopoverTrigger, PopoverContent
} from "@/components/ui/popover";
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
    format, addMonths, subMonths, startOfMonth, endOfMonth,
    startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth,
    isSameDay, addDays, differenceInWeeks, differenceInDays
} from "date-fns";

type RosterPeriod = "weekly" | "fortnightly" | "monthly";

const TIME_OPTIONS = [
    ...Array.from({ length: 24 * 4 }, (_, i) => {
        const hours = Math.floor(i / 4).toString().padStart(2, "0");
        const minutes = ((i % 4) * 15).toString().padStart(2, "0");
        return `${hours}:${minutes}`;
    })
];

const CATEGORIES = [
    { id: 'morning', label: '☀️ Morning' },
    { id: 'afternoon', label: '⛅ Afternoon' },
    { id: 'closing', label: '🔒 Closing' },
    { id: 'delivery', label: '📦 Delivery' },
    { id: 'ordering', label: '📝 Ordering' },
    { id: 'manager', label: '💼 Manager' },
    { id: 'daily', label: '📅 Daily' },
    { id: 'other', label: '🔧 Other' },
];

const getDayName = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split('-');
    if (parts.length !== 3) return "";
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
};

function getRosterDates(offset: number, period: RosterPeriod): Date[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);

    // Normalize to Monday of current week
    const day = today.getDay();
    const diffToMonday = (day === 0 ? -6 : 1 - day);

    if (period === "weekly") {
        start.setDate(today.getDate() + diffToMonday + offset * 7);
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
        });
    } else if (period === "fortnightly") {
        start.setDate(today.getDate() + diffToMonday + offset * 14);
        return Array.from({ length: 14 }, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
        });
    } else {
        // Monthly
        const monthStart = new Date(today.getFullYear(), today.getMonth() + offset, 1);
        const lastDay = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
        return Array.from({ length: lastDay }, (_, i) => {
            const d = new Date(monthStart);
            d.setDate(1 + i);
            return d;
        });
    }
}

function formatDate(d: Date | string) {
    if (!d) return "";
    if (typeof d === "string") {
        const match = d.match(/^\d{4}-\d{2}-\d{2}/);
        if (match) return match[0];
    }
    const dateObj = d instanceof Date ? d : new Date(d);
    if (isNaN(dateObj.getTime())) return "";
    return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
}

function formatShiftTime(timeStr: string) {
    if (!timeStr) return "";
    if (timeStr.includes("T")) {
        return timeStr.split('T')[1]?.substring(0, 5) || "";
    }
    return timeStr.substring(0, 5);
}

function parseConflictDate(dateStr: string) {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return new Date(dateStr);
}

function getPeriodOptions(period: RosterPeriod, count: number = 12): { label: string, start: string, end: string, offset: number }[] {
    const options: { label: string, start: string, end: string, offset: number }[] = [];

    for (let i = -Math.floor(count / 3); i <= count - Math.floor(count / 3); i++) {
        const dates = getRosterDates(i, period);
        const start = dates[0];
        const end = dates[dates.length - 1];

        let prefix = "";
        if (i === 0) prefix = period === "weekly" ? "This week, " : period === "fortnightly" ? "This fortnight, " : "This month, ";
        else if (i === 1) prefix = period === "weekly" ? "Next week, " : period === "fortnightly" ? "Next fortnight, " : "Next month, ";
        else if (i === -1) prefix = period === "weekly" ? "Last week, " : period === "fortnightly" ? "Last fortnight, " : "Last month, ";

        const label = `${prefix}${format(start, "MMM d")} - ${format(end, "MMM d")}`;
        options.push({
            label,
            start: formatDate(start),
            end: formatDate(end),
            offset: i
        });
    }
    return options;
}

export default function OwnerRosterPage() {
    const queryClient = useQueryClient();
    const [offset, setOffset] = useState(0);
    const [rosterPeriod, setRosterPeriod] = useState<RosterPeriod>("weekly");
    const [addShiftOpen, setAddShiftOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [isAttachOpen, setIsAttachOpen] = useState(false);
    const [isTemplatesPanelOpen, setIsTemplatesPanelOpen] = useState(false);
    const [templateSearchQuery, setTemplateSearchQuery] = useState("");
    const [isAutoFilterEnabled, setIsAutoFilterEnabled] = useState(true);
    const [collapsedTemplateCategories, setCollapsedTemplateCategories] = useState<{ [key: string]: boolean }>({});
    const [isDraggingOverChecklist, setIsDraggingOverChecklist] = useState(false);
    const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
    const [adHocTaskText, setAdHocTaskText] = useState("");
    const [adHocTaskInstructions, setAdHocTaskInstructions] = useState("");
    const [adHocTaskRequired, setAdHocTaskRequired] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState<{ [key: string]: boolean }>({});
    const [selectedDate, setSelectedDate] = useState("");
    const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
    const [conflictOpen, setConflictOpen] = useState(false);
    const [conflictData, setConflictData] = useState<any>(null);
    const [pendingForcePayload, setPendingForcePayload] = useState<any>(null);
    const [isConflictEditing, setIsConflictEditing] = useState(false);
    const [duplicateOpen, setDuplicateOpen] = useState(false);
    const [targetDuplicateDate, setTargetDuplicateDate] = useState("");
    const [sourceOffset, setSourceOffset] = useState(0);
    const [targetOffset, setTargetOffset] = useState(1);

    // Mobile specific state
    const isMobile = useIsMobile();
    const [selectedDayIndex, setSelectedDayIndex] = useState(0);
    const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());
    const [isStartDropdownOpen, setIsStartDropdownOpen] = useState(false);
    const [isEndDropdownOpen, setIsEndDropdownOpen] = useState(false);
    const [timeSearch, setTimeSearch] = useState("");

    const rosterDates = useMemo(() => getRosterDates(offset, rosterPeriod), [offset, rosterPeriod]);
    const rangeStart = formatDate(rosterDates[0]);
    const rangeEnd = formatDate(rosterDates[rosterDates.length - 1]);

    // Scroll mobile day picker to selected day on mount
    useEffect(() => {
        if (isMobile) {
            const index = rosterDates.findIndex(d => formatDate(d) === formatDate(new Date()));
            if (index !== -1) {
                setSelectedDayIndex(index);
            }
        }
    }, [isMobile, rosterDates]);

    useEffect(() => {
        setIsAutoFilterEnabled(true);
        setCollapsedTemplateCategories({});
    }, [editingShiftId]);

    // Shift form
    const [shiftEmployee, setShiftEmployee] = useState("");
    const [shiftStart, setShiftStart] = useState("08:00");
    const [shiftEnd, setShiftEnd] = useState("17:00");
    const [shiftType, setShiftType] = useState("morning");
    const [isShiftTypeOverridden, setIsShiftTypeOverridden] = useState(false);
    const [isShiftTypeModalOpen, setIsShiftTypeModalOpen] = useState(false);
    const [shiftTypeSearch, setShiftTypeSearch] = useState("");
    const [initialFormState, setInitialFormState] = useState<any>(null);

    // Auto-detect shift type when start time changes (works for both new and editing shifts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (shiftStart && !isShiftTypeOverridden) {
            const detectedType = getShiftTypeFromTime(shiftStart);
            setShiftType(detectedType);
        }
    }, [shiftStart, isShiftTypeOverridden]);

    // Reset shift form when dialog closes
    useEffect(() => {
        if (!addShiftOpen) {
            setShiftEmployee("");
            setShiftStart("08:00");
            setShiftEnd("17:00");
            setShiftType("morning");
            setIsShiftTypeOverridden(false);
            setIsShiftTypeModalOpen(false);
            setShiftTypeSearch("");
            setEditingShiftId(null);
            setInitialFormState(null);
            setIsAttachOpen(false);
            setIsAddTaskOpen(false);
            setAdHocTaskText("");
            setAdHocTaskInstructions("");
            setAdHocTaskRequired(false);
            setCollapsedGroups({});
        }
    }, [addShiftOpen]);

    // Expansion confirmation state
    const [expansionOpen, setExpansionOpen] = useState(false);
    const [pendingShiftData, setPendingShiftData] = useState<any>(null);

    // Copy Shifts state
    const [copyOption, setCopyOption] = useState<'next_week' | 'prev_week' | 'specific' | 'advanced'>('next_week');
    const [selectedSourceRosterId, setSelectedSourceRosterId] = useState<string>("");
    const [isAdvancedCopy, setIsAdvancedCopy] = useState(false);
    const [advancedCopyConfig, setAdvancedCopyConfig] = useState({
        source_from: "",
        source_to: "",
        target_start: ""
    });

    // Initialize advanced config when dialog opens
    useEffect(() => {
        if (duplicateOpen) {
            setSourceOffset(offset);
            setTargetOffset(offset + 1);
            setAdvancedCopyConfig({
                source_from: rangeStart,
                source_to: rangeEnd,
                target_start: formatDate(addDays(new Date(rangeEnd + 'T00:00:00Z'), 1))
            });
        }
    }, [duplicateOpen, rangeStart, rangeEnd, offset]);

    // Copy Review & Undo state
    const [copyResult, setCopyResult] = useState<{
        copiedCount: number, overlapCount: number, overlapDetails: string[]
    } | null>(null);
    const [resultModalOpen, setResultModalOpen] = useState(false);
    const [lastNewShiftIds, setLastNewShiftIds] = useState<string[]>([]);
    const [undoConfirmOpen, setUndoConfirmOpen] = useState(false);

    const periodOptions = useMemo(() => getPeriodOptions(rosterPeriod), [rosterPeriod]);

    // Search, Filter & Pagination State
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [roleFilter, setRoleFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    const { data: employees = [] } = useQuery({
        queryKey: ["employees"],
        queryFn: () => apiGet<any[]>("/employees"),
    });

    // Local order for drag-and-drop reordering
    const [orderedEmployeeIds, setOrderedEmployeeIds] = useState<string[]>([]);

    useEffect(() => {
        if (employees.length > 0 && orderedEmployeeIds.length === 0) {
            const activeEmpIds = employees.filter((e: any) => e.status === "active").map((e: any) => e.employee_id);
            try {
                const savedOrderStr = localStorage.getItem("roster_employee_order");
                if (savedOrderStr) {
                    const savedOrder = JSON.parse(savedOrderStr);
                    if (Array.isArray(savedOrder)) {
                        // Filter to keep only existing active employee IDs
                        const filteredSaved = savedOrder.filter(id => activeEmpIds.includes(id));
                        // Find any new active employees that weren't in the saved order and append them
                        const newActive = activeEmpIds.filter(id => !savedOrder.includes(id));
                        const finalOrder = [...filteredSaved, ...newActive];
                        setOrderedEmployeeIds(finalOrder);
                        return;
                    }
                }
            } catch (e) {
                console.error("Failed to load employee order from localStorage:", e);
            }
            setOrderedEmployeeIds(activeEmpIds);
        }
    }, [employees, orderedEmployeeIds.length]);

    const filteredEmployees = useMemo(() => {
        const active = employees.filter((e: any) => e.status === "active");

        // Sort by the local ordered list
        const sorted = [...active].sort((a, b) => {
            const indexA = orderedEmployeeIds.indexOf(a.employee_id);
            const indexB = orderedEmployeeIds.indexOf(b.employee_id);
            if (indexA === -1 && indexB === -1) return 0;
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

        return sorted.filter((e: any) => {
            const matchesSearch = `${e.first_name} ${e.last_name}`.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesRole = roleFilter === "all" || e.role?.toLowerCase() === roleFilter;
            return matchesSearch && matchesRole;
        });
    }, [employees, searchQuery, roleFilter, orderedEmployeeIds]);

    const paginatedEmployees = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredEmployees.slice(start, start + pageSize);
    }, [filteredEmployees, currentPage, pageSize]);

    const totalPages = Math.ceil(filteredEmployees.length / pageSize);

    const { data: shifts = [], isLoading, isFetching } = useQuery({
        queryKey: ["shifts", rangeStart, rangeEnd],
        queryFn: () => apiGet<any[]>("/shift", { from: rangeStart, to: rangeEnd }),
    });

    const dynamicRosterShiftTypes = useMemo(() => {
        const baseTypes = ['morning', 'day', 'afternoon', 'evening', 'night', 'closing', 'delivery', 'ordering', 'manager', 'daily'];
        const activeTypes = shifts.map((s: any) => s.shift_type?.toLowerCase()).filter(Boolean);
        return Array.from(new Set([...baseTypes, ...activeTypes]));
    }, [shifts]);

    const isEditingShiftLocked = useMemo(() => {
        if (!editingShiftId) return false;
        const shift = shifts.find((s: any) => s.shift_id === editingShiftId);
        if (!shift) return false;
        // Draft shifts are NEVER locked by time
        if (shift.shift_status === 'draft') return false;
        // Published shifts are locked if they have already started
        return new Date() >= new Date(shift.start_time);
    }, [editingShiftId, shifts]);

    // Get unique roles for filter
    const roles = useMemo(() => {
        const allRoles = employees.map((e: any) => e.role).filter(Boolean);
        return Array.from(new Set(allRoles));
    }, [employees]);

    const { data: rosters = [], isFetching: isFetchingRosters } = useQuery({
        queryKey: ["rosters"],
        queryFn: () => apiGet<any[]>("/rosters"),
    });

    const { data: availability = [] } = useQuery({
        queryKey: ["availability", rangeStart, rangeEnd],
        queryFn: () => apiGet<any[]>("/availability", { from: rangeStart, to: rangeEnd }),
    });

    // Checklist Queries
    const { data: shiftChecklist = [], isLoading: isLoadingChecklist } = useQuery({
        queryKey: ["shift-checklist", editingShiftId],
        queryFn: () => apiGet<any[]>(`/shift/${editingShiftId}/checklist`),
        enabled: !!editingShiftId && addShiftOpen,
    });

    const { data: templates = [] } = useQuery({
        queryKey: ["checklist-templates"],
        queryFn: () => apiGet<any[]>("/checklist-templates", { is_active: 'true' }),
        enabled: addShiftOpen,
    });

    const CATEGORY_ORDER = ['morning', 'afternoon', 'closing', 'delivery', 'ordering', 'manager', 'daily'];

    const sortedTemplates = useMemo(() => {
        if (!templates) return [];
        return [...templates].sort((a: any, b: any) => {
            const catA = a.category?.toLowerCase() || "";
            const catB = b.category?.toLowerCase() || "";
            
            let indexA = CATEGORY_ORDER.indexOf(catA);
            let indexB = CATEGORY_ORDER.indexOf(catB);
            
            if (indexA === -1) indexA = 999;
            if (indexB === -1) indexB = 999;
            
            if (indexA !== indexB) {
                return indexA - indexB;
            }
            
            return (a.sort_order ?? 0) - (b.sort_order ?? 0);
        });
    }, [templates]);

    const filteredTemplates = useMemo(() => {
        if (!sortedTemplates) return [];
        let list = sortedTemplates;

        if (isAutoFilterEnabled) {
            const dayName = getDayName(selectedDate); // e.g. "monday"
            const dayAbbrev = dayName ? dayName.substring(0, 3) : ""; // e.g. "mon"
            
            list = list.filter((t: any) => {
                const categoryLower = t.category?.toLowerCase() || "";
                const nameLower = t.name?.toLowerCase() || "";
                const descLower = t.description?.toLowerCase() || "";

                // Match if category is the shift type
                const matchesShiftType = shiftType && categoryLower === shiftType.toLowerCase();

                // Match if template mentions the day name (e.g. "monday" or "mon")
                const dayWordRegex = dayAbbrev ? new RegExp(`\\b${dayAbbrev}\\b`, 'i') : null;
                const matchesDayName = dayName && (
                    categoryLower === dayName ||
                    nameLower.includes(dayName) ||
                    descLower.includes(dayName) ||
                    (dayWordRegex && (dayWordRegex.test(nameLower) || dayWordRegex.test(descLower)))
                );

                return matchesShiftType || matchesDayName;
            });
        }

        return list.filter((t: any) =>
            t.name.toLowerCase().includes(templateSearchQuery.toLowerCase()) ||
            (t.description && t.description.toLowerCase().includes(templateSearchQuery.toLowerCase()))
        );
    }, [sortedTemplates, templateSearchQuery, isAutoFilterEnabled, shiftType, selectedDate]);

    const templatesByCategory = useMemo(() => {
        const grouped: Record<string, any[]> = {};
        filteredTemplates.forEach((t: any) => {
            const cat = t.category?.toLowerCase() || 'other';
            const standardCategoryIds = ['morning', 'afternoon', 'closing', 'delivery', 'ordering', 'manager', 'daily'];
            const key = standardCategoryIds.includes(cat) ? cat : 'other';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(t);
        });
        return grouped;
    }, [filteredTemplates]);

    const groupedChecklist = useMemo(() => {
        const groups: { [key: string]: { name: string, items: any[] } } = {};

        shiftChecklist.forEach((item: any) => {
            const tempId = item.source_template_id || 'custom';
            if (!groups[tempId]) {
                let name = '🔧 Custom Tasks';
                if (tempId !== 'custom') {
                    const matchedTemplate = sortedTemplates.find((t: any) => t.template_id === tempId);
                    name = matchedTemplate ? `📋 ${matchedTemplate.name}` : '📋 Attached Template Tasks';
                }
                groups[tempId] = { name, items: [] };
            }
            groups[tempId].items.push(item);
        });

        // Convert to array and sort groups: templates first (according to template list sequence), then custom tasks at the end
        const finalGroups = Object.keys(groups).map(key => ({
            id: key,
            name: groups[key].name,
            items: groups[key].items
        }));

        finalGroups.sort((a, b) => {
            if (a.id === 'custom') return 1;
            if (b.id === 'custom') return -1;
            const indexA = sortedTemplates.findIndex((t: any) => t.template_id === a.id);
            const indexB = sortedTemplates.findIndex((t: any) => t.template_id === b.id);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

        // Sort items inside groups by sort_order
        finalGroups.forEach(g => {
            g.items.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        });

        return finalGroups;
    }, [shiftChecklist, sortedTemplates]);

    const toggleGroup = useCallback((groupId: string) => {
        setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    }, []);

    const toggleTemplateCategory = useCallback((catId: string) => {
        setCollapsedTemplateCategories(prev => ({ ...prev, [catId]: prev[catId] === false ? true : false }));
    }, []);

    const { data: checklistSummary = [] } = useQuery({
        queryKey: ["checklist-review", rangeStart, rangeEnd],
        queryFn: () => apiGet<any[]>("/checklist-review", { from: rangeStart, to: rangeEnd }),
        enabled: !!rangeStart && !!rangeEnd,
    });

    // Helper to calculate progress for a specific shift
    const getShiftProgress = useCallback((shiftId: string) => {
        const items = checklistSummary.filter((item: any) => item.shift_id === shiftId);
        if (items.length === 0) return null;

        const total = items.length;
        const completed = items.filter((item: any) => item.status === 'done').length;
        const requiredCompleted = items.filter((item: any) => item.is_required && item.status === 'done').length;
        const requiredTotal = items.filter((item: any) => item.is_required).length;
        const allRequiredDone = requiredTotal === requiredCompleted;

        return {
            total,
            completed,
            requiredTotal,
            requiredCompleted,
            allRequiredDone,
            percent: Math.round((completed / total) * 100)
        };
    }, [checklistSummary]);

    // Real-time listener
    useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel('owner-roster-realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'Shift'
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["shifts"] });
                    queryClient.invalidateQueries({ queryKey: ["rosters"] });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'Roster'
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["shifts"] });
                    queryClient.invalidateQueries({ queryKey: ["rosters"] });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'ShiftChecklistItem'
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["shifts"] });
                    queryClient.invalidateQueries({ queryKey: ["shift-checklist"] });
                    queryClient.invalidateQueries({ queryKey: ["checklist-review"] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    // Auto-detect roster period from data on load
    const [hasAutoSet, setHasAutoSet] = useState(false);
    useEffect(() => {
        if (!hasAutoSet && rosters.length > 0) {
            // Find the most recent roster
            const latest = rosters[0]; // Roster API usually returns newest first
            if (latest) {
                const start = new Date(latest.start_date);
                const end = new Date(latest.end_date);
                const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                if (diffDays > 20) setRosterPeriod("monthly");
                else if (diffDays > 10) setRosterPeriod("fortnightly");
                else setRosterPeriod("weekly");

                setHasAutoSet(true);
            }
        }
    }, [rosters, hasAutoSet]);

    const createShiftMutation = useMutation({
        mutationFn: (data: any) => apiPost("/shift", data),
        onMutate: async (newShift) => {
            await queryClient.cancelQueries({ queryKey: ["shifts", rangeStart, rangeEnd] });
            const previousShifts = queryClient.getQueryData(["shifts", rangeStart, rangeEnd]);
            queryClient.setQueryData(["shifts", rangeStart, rangeEnd], (old: any[] = []) => [
                ...old,
                { ...newShift, shift_id: `temp_${Date.now()}`, status: 'draft' }
            ]);
            return { previousShifts };
        },
        onSuccess: (data: any, variables: any, context: any) => {
            if (data && (data as any).status === 'conflict') {
                if (context?.previousShifts) {
                    queryClient.setQueryData(["shifts", rangeStart, rangeEnd], context.previousShifts);
                }
                setConflictData((data as any).conflict);
                setPendingForcePayload(variables);
                setIsConflictEditing(false);
                setConflictOpen(true);
            } else {
                toast.success("Shift created");
                setAddShiftOpen(false);
            }
        },
        onError: (err: Error, newShift, context: any) => {
            toast.error(err.message);
            if (context?.previousShifts) {
                queryClient.setQueryData(["shifts", rangeStart, rangeEnd], context.previousShifts);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["shifts"] });
            queryClient.invalidateQueries({ queryKey: ["rosters"] });
        },
    });

    const updateShiftMutation = useMutation({
        mutationFn: (data: any) => apiPut(`/shift/${editingShiftId}`, data),
        onMutate: async (updatedShift) => {
            await queryClient.cancelQueries({ queryKey: ["shifts", rangeStart, rangeEnd] });
            const previousShifts = queryClient.getQueryData(["shifts", rangeStart, rangeEnd]);
            queryClient.setQueryData(["shifts", rangeStart, rangeEnd], (old: any[] = []) =>
                old.map((s: any) => s.shift_id === editingShiftId ? { ...s, ...updatedShift } : s)
            );
            return { previousShifts };
        },
        onSuccess: (data: any, variables: any, context: any) => {
            if (data && (data as any).status === 'conflict') {
                if (context?.previousShifts) {
                    queryClient.setQueryData(["shifts", rangeStart, rangeEnd], context.previousShifts);
                }
                setConflictData((data as any).conflict);
                setPendingForcePayload(variables);
                setIsConflictEditing(true);
                setConflictOpen(true);
            } else {
                toast.success("Shift updated");
                setAddShiftOpen(false);
            }
        },
        onError: (err: Error, updatedShift, context: any) => {
            toast.error(err.message);
            if (context?.previousShifts) {
                queryClient.setQueryData(["shifts", rangeStart, rangeEnd], context.previousShifts);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["shifts"] });
            queryClient.invalidateQueries({ queryKey: ["rosters"] });
        },
    });

    const deleteShiftMutation = useMutation({
        mutationFn: (shiftId: string) => apiDelete(`/shift/${shiftId}`),
        onMutate: async (shiftId) => {
            await queryClient.cancelQueries({ queryKey: ["shifts", rangeStart, rangeEnd] });
            const previousShifts = queryClient.getQueryData(["shifts", rangeStart, rangeEnd]);
            queryClient.setQueryData(["shifts", rangeStart, rangeEnd], (old: any[] = []) =>
                old.filter((s: any) => s.shift_id !== shiftId)
            );
            return { previousShifts };
        },
        onSuccess: () => {
            toast.success("Shift deleted");
            setDeleteConfirmOpen(false);
            setAddShiftOpen(false);
        },
        onError: (err: Error, shiftId, context: any) => {
            toast.error(err.message);
            if (context?.previousShifts) {
                queryClient.setQueryData(["shifts", rangeStart, rangeEnd], context.previousShifts);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["shifts"] });
            queryClient.invalidateQueries({ queryKey: ["rosters"] });
        },
    });

    const [deleteRosterConfirmOpen, setDeleteRosterConfirmOpen] = useState(false);
    const deleteRosterMutation = useMutation({
        mutationFn: (rosterId: string) => apiDelete(`/rosters/${rosterId}`),
        onSuccess: () => {
            toast.success("Roster deleted successfully");
            queryClient.invalidateQueries({ queryKey: ["rosters"] });
            queryClient.invalidateQueries({ queryKey: ["shifts"] });
            setDeleteRosterConfirmOpen(false);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const notifyShiftMutation = useMutation({
        mutationFn: (shiftId: string) => apiPost(`/shift/${shiftId}/notify`, {}),
        onMutate: async (shiftId) => {
            await queryClient.cancelQueries({ queryKey: ["shifts", rangeStart, rangeEnd] });
            const previousShifts = queryClient.getQueryData(["shifts", rangeStart, rangeEnd]);
            queryClient.setQueryData(["shifts", rangeStart, rangeEnd], (old: any[] = []) =>
                old.map((s: any) => s.shift_id === shiftId ? { ...s, status: 'published' } : s)
            );
            return { previousShifts };
        },
        onSuccess: () => {
            toast.success("Shift published & employee notified!", { icon: "🔔" });
        },
        onError: (err: Error, shiftId, context: any) => {
            toast.error(err.message);
            if (context?.previousShifts) {
                queryClient.setQueryData(["shifts", rangeStart, rangeEnd], context.previousShifts);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["shifts"] });
        },
    });


    const duplicateRosterMutation = useMutation({
        mutationFn: (data: { source_from: string; source_to: string; target_start: string }) =>
            apiPost(`/rosters/copy-shifts`, data),
        onSuccess: (res: any) => {
            setCopyResult({
                copiedCount: res.copiedCount,
                overlapCount: res.overlapCount,
                overlapDetails: res.overlapDetails
            });
            setLastNewShiftIds(res.newShiftIds || []);
            setResultModalOpen(true);

            queryClient.invalidateQueries({ queryKey: ["rosters"] });
            queryClient.invalidateQueries({ queryKey: ["shifts"] });
            setDuplicateOpen(false);

            // Auto-jump to the target period
            setOffset(offset + 1);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const undoLastCopyMutation = useMutation({
        mutationFn: () => apiPost("/shift/delete-many", { ids: lastNewShiftIds }),
        onSuccess: () => {
            toast.success("Last copy operation undone successfully");
            setLastNewShiftIds([]);
            queryClient.invalidateQueries({ queryKey: ["shifts"] });
            queryClient.invalidateQueries({ queryKey: ["rosters"] });
            setUndoConfirmOpen(false);
            setResultModalOpen(false);
            // Optionally jump back?
            setOffset(offset - 1);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const publishRosterMutation = useMutation({
        mutationFn: (rosterId: string) => apiPost(`/rosters/${rosterId}/publish`, {}),
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ["shifts", rangeStart, rangeEnd] });
            const previousShifts = queryClient.getQueryData(["shifts", rangeStart, rangeEnd]);
            queryClient.setQueryData(["shifts", rangeStart, rangeEnd], (old: any[] = []) =>
                old.map((s: any) => (s.status === 'draft' || !s.status) ? { ...s, status: 'published' } : s)
            );
            return { previousShifts };
        },
        onSuccess: () => {
            toast.success("Shifts published and employees notified!");
        },
        onError: (err: Error, rosterId, context: any) => {
            toast.error(err.message);
            if (context?.previousShifts) {
                queryClient.setQueryData(["shifts", rangeStart, rangeEnd], context.previousShifts);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["rosters"] });
            queryClient.invalidateQueries({ queryKey: ["shifts"] });
        },
    });

    // Checklist Mutations
    const addTaskMutation = useMutation({
        mutationFn: (data: any) => apiPost(`/shift/${editingShiftId}/checklist`, data),
        onSuccess: () => {
            toast.success("Task added to shift");
            queryClient.invalidateQueries({ queryKey: ["shift-checklist", editingShiftId] });
            queryClient.invalidateQueries({ queryKey: ["shifts"] });
            setIsAddTaskOpen(false);
            setAdHocTaskText("");
            setAdHocTaskInstructions("");
            setAdHocTaskRequired(false);
        },
        onError: (err: any) => toast.error(err.message),
    });

    const updateTaskMutation = useMutation({
        mutationFn: ({ itemId, data }: { itemId: string, data: any }) =>
            apiPatch(`/shift/${editingShiftId}/checklist/${itemId}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["shift-checklist", editingShiftId] });
            queryClient.invalidateQueries({ queryKey: ["shifts"] });
        },
        onError: (err: any) => toast.error(err.message),
    });

    const deleteTaskMutation = useMutation({
        mutationFn: (itemId: string) => apiDelete(`/shift/${editingShiftId}/checklist/${itemId}`),
        onSuccess: () => {
            toast.success("Task removed");
            queryClient.invalidateQueries({ queryKey: ["shift-checklist", editingShiftId] });
            queryClient.invalidateQueries({ queryKey: ["shifts"] });
        },
        onError: (err: any) => toast.error(err.message),
    });

    const attachTemplateMutation = useMutation({
        mutationFn: (templateIds: string[]) => {
            console.log('[RosterPage] attachTemplateMutation mutationFn executing with templateIds:', templateIds, 'and editingShiftId:', editingShiftId);
            return apiPut(`/shift/${editingShiftId}/checklist`, { template_ids: templateIds });
        },
        onSuccess: () => {
            console.log('[RosterPage] attachTemplateMutation onSuccess called');
            toast.success("Template tasks attached");
            queryClient.invalidateQueries({ queryKey: ["shift-checklist", editingShiftId] });
            queryClient.invalidateQueries({ queryKey: ["shifts"] });
        },
        onError: (err: any) => {
            console.error('[RosterPage] attachTemplateMutation onError called:', err);
            toast.error(err.message);
        },
    });

    const removeTemplateTasksMutation = useMutation({
        mutationFn: (templateId: string) => {
            console.log('[RosterPage] removeTemplateTasksMutation executing with templateId:', templateId, 'and editingShiftId:', editingShiftId);
            return apiDelete(`/shift/${editingShiftId}/checklist/template/${templateId}`);
        },
        onSuccess: () => {
            toast.success("Template tasks removed");
            queryClient.invalidateQueries({ queryKey: ["shift-checklist", editingShiftId] });
            queryClient.invalidateQueries({ queryKey: ["shifts"] });
        },
        onError: (err: any) => {
            console.error('[RosterPage] removeTemplateTasksMutation onError called:', err);
            toast.error(err.message);
        },
    });

    const handleAddShift = () => {
        if (!shiftEmployee || !selectedDate) {
            toast.error("Please select an employee and date");
            return;
        }

        const now = new Date();
        const start = new Date(`${selectedDate}T${shiftStart}:00`);
        if (start < now && !editingShiftId) {
            toast.error("Cannot create a shift that starts in the past.");
            return;
        }

        // Check availability
        const isAvailable = availability.find((a: any) => a.employee_id === shiftEmployee && a.date === selectedDate)?.is_available !== false;
        if (!isAvailable) {
            toast.error("Employee is unavailable on this date");
            return;
        }

        const payload = {
            employee_id: shiftEmployee,
            shift_date: selectedDate,
            start_time: `${selectedDate}T${shiftStart}:00`,
            end_time: `${selectedDate}T${shiftEnd}:00`,
            shift_type: shiftType,
            roster_start: rangeStart,
            roster_end: rangeEnd,
        };

        // Check for expansion
        if (currentRoster) {
            const rosterStart = formatDate(currentRoster.start_date);
            const rosterEnd = formatDate(currentRoster.end_date);

            if (selectedDate < rosterStart || selectedDate > rosterEnd) {
                setPendingShiftData(payload);
                setExpansionOpen(true);
                return;
            }
        }

        if (editingShiftId) {
            updateShiftMutation.mutate(payload);
        } else {
            createShiftMutation.mutate(payload);
        }
    };

    const confirmExpansion = () => {
        if (!pendingShiftData) return;
        if (editingShiftId) {
            updateShiftMutation.mutate(pendingShiftData);
        } else {
            createShiftMutation.mutate(pendingShiftData);
        }
        setExpansionOpen(false);
        setPendingShiftData(null);
    };

    const handleForceSchedule = () => {
        if (!pendingForcePayload) return;
        const payload = {
            ...pendingForcePayload,
            force: true
        };
        if (isConflictEditing && editingShiftId) {
            updateShiftMutation.mutate(payload);
        } else {
            createShiftMutation.mutate(payload);
        }
        setConflictOpen(false);
    };

    const openAddShift = (date: string, empId = "", shift: any = null) => {
        setSelectedDate(date);
        setShiftEmployee(empId);

        if (shift) {
            setEditingShiftId(shift.shift_id);
            const parseTime = (timeStr: string) => {
                if (!timeStr) return "09:00";
                if (timeStr.includes("T")) {
                    return timeStr.split('T')[1]?.substring(0, 5) || "09:00";
                }
                return timeStr.substring(0, 5);
            };
            const startTime = parseTime(shift.start_time);
            const endTime = parseTime(shift.end_time);

            const savedType = shift.shift_type || getShiftTypeFromTime(startTime);
            const autoDetectedType = getShiftTypeFromTime(startTime);
            const overridden = savedType !== autoDetectedType;

            setShiftStart(startTime);
            setShiftEnd(endTime);
            setShiftType(savedType);
            setIsShiftTypeOverridden(overridden);
            setInitialFormState({
                employee_id: empId,
                shift_date: date,
                start_time: startTime,
                end_time: endTime,
                shift_type: savedType
            });
        } else {
            setEditingShiftId(null);
            setInitialFormState(null);

            setShiftStart("08:00");
            setShiftEnd("17:00");
            setShiftType("morning");
            setIsShiftTypeOverridden(false);
        }
        setAddShiftOpen(true);
    };

    const isDirty = useMemo(() => {
        if (!editingShiftId || !initialFormState) return true;
        return (
            shiftEmployee !== initialFormState.employee_id ||
            selectedDate !== initialFormState.shift_date ||
            shiftStart !== initialFormState.start_time ||
            shiftEnd !== initialFormState.end_time ||
            shiftType !== initialFormState.shift_type
        );
    }, [editingShiftId, initialFormState, shiftEmployee, selectedDate, shiftStart, shiftEnd, shiftType]);

    const shiftGrid = useMemo(() => {
        const grid: Record<string, Record<string, any[]>> = {};
        for (const s of shifts) {
            const empId = s.employee_id || "unassigned";
            const date = s.shift_date?.split("T")[0] || s.shift_date;
            if (!grid[empId]) grid[empId] = {};
            if (!grid[empId][date]) grid[empId][date] = [];
            grid[empId][date].push(s);
        }
        return grid;
    }, [shifts]);

    const activeEmployees = employees.filter((e: any) => e.status === "active");

    const conflictEmployee = employees.find(
        (e: any) => e.employee_id === pendingForcePayload?.employee_id
    );
    const conflictEmployeeName = conflictEmployee
        ? `${conflictEmployee.first_name || ""} ${conflictEmployee.last_name || ""}`.trim()
        : "Employee";

    const currentRoster = useMemo(() => {
        // Find the roster record that encompasses the current view range
        return rosters.find((r: any) =>
            formatDate(r.start_date) <= rangeEnd &&
            formatDate(r.end_date) >= rangeStart
        );
    }, [rosters, rangeStart, rangeEnd]);

    // Use explicit shift_status field for published check
    const isShiftPublished = useCallback((shift: any) => {
        return shift.shift_status === 'published';
    }, []);

    const statusSummary = useMemo(() => {
        let published = 0;
        let drafts = 0;
        let total = 0;
        let totalHours = 0;
        let totalPublishedHours = 0;
        let totalDraftHours = 0;

        // Create a Set of filtered employee IDs for faster lookups
        const filteredIds = new Set(filteredEmployees.map((e: any) => e.employee_id));

        for (const s of shifts) {
            // Only include shifts for employees currently in the filtered list
            if (!filteredIds.has(s.employee_id)) continue;

            const d = s.shift_date?.split('T')[0] || s.shift_date;
            if (d < rangeStart || d > rangeEnd) continue;

            total++;

            // Calculate hours for ALL shifts in range
            if (s.start_time && s.end_time) {
                const startTimeStr = s.start_time?.split('T')[1]?.substring(0, 5) || (typeof s.start_time === 'string' && s.start_time.length === 5 ? s.start_time : "00:00");
                const endTimeStr = s.end_time?.split('T')[1]?.substring(0, 5) || (typeof s.end_time === 'string' && s.end_time.length === 5 ? s.end_time : "00:00");

                const hours = calculateShiftDuration(startTimeStr, endTimeStr);
                if (hours > 0) {
                    totalHours += hours;
                    if (s.shift_status === 'published') {
                        totalPublishedHours += hours;
                    } else {
                        totalDraftHours += hours;
                    }
                }
            }

            if (s.shift_status === 'published') {
                published++;
            } else {
                drafts++;
            }
        }
        return {
            total,
            published,
            drafts,
            modified: 0,
            allPublished: total > 0 && total === published,
            totalHours,
            totalPublishedHours,
            totalDraftHours
        };
    }, [shifts, rangeStart, rangeEnd, filteredEmployees]);

    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    const handleDateSelect = (date: Date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find Monday of today's week
        const day = today.getDay();
        const diffToMonday = (day === 0 ? -6 : 1 - day);
        const todayMonday = new Date(today);
        todayMonday.setDate(today.getDate() + diffToMonday);

        let newOffset = 0;
        if (rosterPeriod === "weekly") {
            const diffDays = Math.floor((date.getTime() - todayMonday.getTime()) / (1000 * 60 * 60 * 24));
            newOffset = Math.floor(diffDays / 7);
        } else if (rosterPeriod === "fortnightly") {
            const diffDays = Math.floor((date.getTime() - todayMonday.getTime()) / (1000 * 60 * 60 * 24));
            newOffset = Math.floor(diffDays / 14);
        } else {
            newOffset = (date.getFullYear() - today.getFullYear()) * 12 + (date.getMonth() - today.getMonth());
        }

        setOffset(newOffset);
        setIsCalendarOpen(false);
    };

    return (
        <DashboardLayout
            role="owner"
            pageTitle="Roster Management"
            defaultCollapsed={true}
            pageDescription={`${rosterPeriod.charAt(0).toUpperCase() + rosterPeriod.slice(1)} Roster: ${rosterDates[0].toLocaleDateString("en-AU", { month: "short", day: "numeric" })} – ${rosterDates[rosterDates.length - 1].toLocaleDateString("en-AU", { month: "short", day: "numeric", year: "numeric" })}`}
            actions={
                <div className="flex items-center gap-3">
                    <div className="hidden lg:flex bg-[hsl(var(--muted))] p-1 rounded-lg border border-[hsl(var(--border))]">
                        {(["weekly", "fortnightly", "monthly"] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => {
                                    setRosterPeriod(p);
                                    setOffset(0);
                                    setCurrentPage(1);
                                }}
                                className={cn(
                                    "px-4 py-1.5 text-xs font-extrabold rounded-md transition-all tracking-tight",
                                    rosterPeriod === p
                                        ? "bg-white text-[hsl(var(--brand))] shadow-sm ring-1 ring-black/5"
                                        : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                                )}
                            >
                                {p.charAt(0).toUpperCase() + p.slice(1)}
                            </button>
                        ))}
                    </div>
                    <Button
                        onClick={() => openAddShift(formatDate(new Date()))}
                        disabled={isFetching || isFetchingRosters}
                        className="hidden lg:flex shadow-lg shadow-[hsl(var(--brand))]/10"
                    >
                        <Plus size={16} className="mr-2" /> Add Shift
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4 min-h-[44px]">
                {/* 1. Search & Filters (Top on Mobile, Middle on Desktop) */}
                <div className="hidden sm:flex flex-wrap lg:flex-nowrap items-center gap-3 flex-1 w-full lg:max-w-xl sm:mx-4 order-1 sm:order-2">
                    {/* Desktop Search */}
                    <div className="relative group transition-all duration-300 flex-1 min-w-[150px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] group-focus-within:text-[hsl(var(--brand))] transition-colors" />
                        <Input
                            placeholder="Search employee..."
                            className="pl-9 h-10 w-full bg-white border-[hsl(var(--border))] rounded-xl focus:ring-2 focus:ring-[hsl(var(--brand))]/10 pr-10"
                            value={searchQuery}
                            autoFocus={isSearchExpanded}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                        />
                        {isSearchExpanded && (
                            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent" onClick={() => { setIsSearchExpanded(false); setSearchQuery(""); }}>
                                <X size={14} className="text-[hsl(var(--muted-foreground))]" />
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {/* Role Filter */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="h-10 rounded-xl gap-2 px-3 border-[hsl(var(--border))] bg-white hover:bg-[hsl(var(--muted))]/30 text-xs shadow-sm focus:ring-2 focus:ring-[hsl(var(--brand))]/10 focus:border-transparent">
                                    <Filter size={14} className="text-[hsl(var(--muted-foreground))]" />
                                    <span className="font-semibold">{roleFilter === 'all' ? 'All Roles' : (roleFilter === 'manager' ? 'Managers' : 'Staff')}</span>
                                    <ChevronDown size={14} className="opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 rounded-2xl shadow-xl p-1.5 border-[hsl(var(--border))] animate-in fade-in zoom-in-95 duration-200">
                                <DropdownMenuItem onClick={() => { setRoleFilter("all"); setCurrentPage(1); }} className={cn("cursor-pointer font-medium text-xs rounded-lg py-2 transition-all", roleFilter === "all" && "bg-[hsl(var(--brand-light))]/50 text-[hsl(var(--brand))]")}>All Roles</DropdownMenuItem>
                                <DropdownMenuSeparator className="my-1" />
                                {roles.map(r => (
                                    <DropdownMenuItem
                                        key={r}
                                        onClick={() => { setRoleFilter(r.toLowerCase()); setCurrentPage(1); }}
                                        className={cn(
                                            "cursor-pointer font-medium text-xs rounded-lg py-2 transition-all",
                                            roleFilter === r.toLowerCase() && "bg-[hsl(var(--brand-light))]/50 text-[hsl(var(--brand))]"
                                        )}
                                    >
                                        {r === 'manager' ? 'Managers' : r === 'employee' ? 'Staff' : r.split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Weekly Hours Widget */}
                        <div className="hidden sm:flex items-center gap-2 h-10 px-3 bg-white border border-[hsl(var(--border))] rounded-xl shadow-sm">
                            <div className="flex flex-col justify-center border-r border-[hsl(var(--border))] pr-3">
                                <span className="text-[8px] font-black uppercase text-emerald-600 tracking-widest leading-tight">Published</span>
                                <span className="text-[11px] font-black text-emerald-900 leading-tight block">{formatDurationHours(statusSummary.totalPublishedHours)}</span>
                            </div>
                            <div className="flex flex-col justify-center pr-3 border-r border-[hsl(var(--border))]">
                                <span className="text-[8px] font-black uppercase text-orange-600 tracking-widest leading-tight">Draft</span>
                                <span className="text-[11px] font-black text-orange-900 leading-tight block">{formatDurationHours(statusSummary.totalDraftHours)}</span>
                            </div>
                            <div className="flex flex-col justify-center">
                                <span className="text-[8px] font-black uppercase text-[hsl(var(--brand))] tracking-widest leading-tight">Total</span>
                                <span className="text-[11px] font-black text-[hsl(var(--foreground))] leading-tight block">{formatDurationHours(statusSummary.totalHours)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Date Navigation (Bottom on Mobile, Left on Desktop) */}
                <div className="flex items-center justify-center w-full sm:w-auto gap-2 order-2 sm:order-1">
                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg" onClick={() => setOffset(offset - 1)}>
                        <ChevronLeft size={18} />
                    </Button>

                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <PopoverTrigger asChild>
                            <button
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border",
                                    offset === 0
                                        ? "bg-[hsl(var(--brand))]/10 text-[hsl(var(--brand))] border-[hsl(var(--brand))]/20"
                                        : "bg-white text-[hsl(var(--foreground))] border-[hsl(var(--border))] hover:bg-[hsl(var(--brand))]/5"
                                )}
                            >
                                <CalendarDays size={14} />
                                <span>
                                    {rosterDates[0].toLocaleDateString("en-AU", { month: "short", day: "numeric" })}
                                    {" – "}
                                    {rosterDates[rosterDates.length - 1].toLocaleDateString("en-AU", { month: "short", day: "numeric" })}
                                </span>
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0 overflow-hidden rounded-xl shadow-2xl border-[hsl(var(--border))]" align="start">
                            <div className="p-4 bg-white">
                                <div className="flex items-center justify-between mb-4 px-1">
                                    <h4 className="font-bold text-[hsl(var(--foreground))] text-base">
                                        {format(calendarMonth, "MMM yyyy")}
                                    </h4>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-full"
                                            onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                                        >
                                            <ChevronLeft size={16} />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-full"
                                            onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                                        >
                                            <ChevronRight size={16} />
                                        </Button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-7 gap-1 mb-2">
                                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                                        <div key={day} className="text-center text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))] py-2">
                                            {day[0]}
                                        </div>
                                    ))}
                                    {(() => {
                                        const start = startOfWeek(startOfMonth(calendarMonth));
                                        const end = endOfWeek(endOfMonth(calendarMonth));
                                        const days = eachDayOfInterval({ start, end });

                                        return days.map((day) => {
                                            const isSelected = rosterDates.some(d => isSameDay(d, day));
                                            const inMonth = isSameMonth(day, calendarMonth);
                                            const isToday = isSameDay(day, new Date());

                                            return (
                                                <button
                                                    key={day.toISOString()}
                                                    onClick={() => handleDateSelect(day)}
                                                    className={cn(
                                                        "h-9 w-9 text-xs rounded-full flex items-center justify-center transition-all",
                                                        !inMonth && "text-[hsl(var(--muted-foreground))]/30 hover:bg-transparent",
                                                        inMonth && !isSelected && "hover:bg-[hsl(var(--brand))]/10 text-[hsl(var(--foreground))]",
                                                        isSelected && "bg-[hsl(var(--brand))] text-white font-bold shadow-lg shadow-[hsl(var(--brand))]/20",
                                                        isToday && !isSelected && "border-2 border-[hsl(var(--brand))]/40"
                                                    )}
                                                >
                                                    {format(day, "d")}
                                                </button>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg" onClick={() => setOffset(offset + 1)}>
                        <ChevronRight size={18} />
                    </Button>
                </div>

                {/* 3. Status/Sync (Right on both) */}
                <div className="flex items-center gap-3 order-3">
                    {isFetching || isFetchingRosters ? (
                        <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] animate-pulse">
                            <RefreshCcw size={14} className="animate-spin text-[hsl(var(--brand))]" />
                            <span>Syncing...</span>
                        </div>
                    ) : (
                        statusSummary.total > 0 ? (
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col items-end">
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant={statusSummary.allPublished ? "default" : "outline"}
                                            className={statusSummary.allPublished
                                                ? "bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))] text-white"
                                                : "border-[hsl(var(--warning-foreground))] text-[hsl(var(--warning-foreground))] bg-[hsl(var(--warning))]/10"
                                            }
                                        >
                                            {statusSummary.allPublished ? (
                                                <div className="flex items-center gap-1">
                                                    <CheckCircle2 size={12} />
                                                    <span>Published</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1">
                                                    <FileText size={12} />
                                                    <span>Draft ({statusSummary.total - statusSummary.published} shifts)</span>
                                                </div>
                                            )}
                                        </Badge>
                                        {currentRoster && (
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        const nextDate = new Date(currentRoster.end_date);
                                                        nextDate.setDate(nextDate.getDate() + 1);
                                                        setTargetDuplicateDate(formatDate(nextDate));
                                                        setDuplicateOpen(true);
                                                    }}
                                                    className="h-7 px-3 text-xs"
                                                >
                                                    <Copy size={12} className="mr-1" /> Duplicate
                                                </Button>
                                                {currentRoster.status === 'draft' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => setDeleteRosterConfirmOpen(true)}
                                                        className="h-7 px-3 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                                                    >
                                                        <Trash2 size={12} className="mr-1" /> Delete
                                                    </Button>
                                                )}
                                                {statusSummary.drafts > 0 && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => publishRosterMutation.mutate(currentRoster.roster_id)}
                                                        className="h-7 px-3 text-xs bg-[hsl(var(--brand))] hover:bg-[hsl(var(--brand-hover))]"
                                                    >
                                                        <Bell size={12} className="mr-1" /> Publish {statusSummary.drafts} Shift{statusSummary.drafts > 1 ? 's' : ''}
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-medium mt-1">
                                        {statusSummary.published} published ({formatDurationHours(statusSummary.totalPublishedHours)}) • {statusSummary.drafts} drafts ({formatDurationHours(statusSummary.totalDraftHours)})
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="border-[hsl(var(--muted-foreground))] text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))]/10">
                                    No shifts
                                </Badge>
                                <span className="text-xs text-[hsl(var(--muted-foreground))] italic hidden sm:inline">Add a shift to start rostering</span>
                            </div>
                        )
                    )}
                </div>
            </div>

            <div className={cn(
                "w-full max-w-full relative overflow-hidden",
                !isMobile && "rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-md"
            )}>
                {isMobile ? (
                    /* MOBILE DAY VIEW */
                    <div className="flex flex-col min-h-screen relative">
                        {/* Integrated Mobile Calendar Header */}
                        <div className="bg-white px-3 pt-4 flex flex-col items-center justify-center">
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn("h-10 w-10 text-[hsl(var(--muted-foreground))]", isCalendarExpanded && "text-[hsl(var(--brand))] bg-[hsl(var(--brand-light))]/30")}
                                onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
                            >
                                <CalendarDays size={24} />
                            </Button>
                            <div className="pb-2 text-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[hsl(var(--muted-foreground))] opacity-60">
                                    {format(rosterDates[selectedDayIndex], "EEE d MMM")}
                                </span>
                            </div>
                        </div>

                        {/* Expandable Month Calendar */}
                        <AnimatePresence>
                            {isCalendarExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                    className="overflow-hidden bg-white border-b border-[hsl(var(--border))]"
                                    drag="y"
                                    dragConstraints={{ top: 0, bottom: 0 }}
                                    onDragEnd={(_e, info) => {
                                        if (info.offset.y < -50) setIsCalendarExpanded(false);
                                    }}
                                >
                                    <div className="p-4 pt-2">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-sm font-black uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                                                {format(viewDate, "MMMM yyyy")}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewDate(subMonths(viewDate, 1))}>
                                                    <ChevronLeft size={16} />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewDate(addMonths(viewDate, 1))}>
                                                    <ChevronRight size={16} />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Day Names Grid */}
                                        <div className="grid grid-cols-7 mb-2">
                                            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                                                <div key={i} className="text-center text-[10px] font-black text-[hsl(var(--muted-foreground))]/60">
                                                    {d}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Days Grid */}
                                        <div className="grid grid-cols-7 gap-1">
                                            {(() => {
                                                const monthStart = startOfMonth(viewDate);
                                                const monthEnd = endOfMonth(monthStart);
                                                const startDate = startOfWeek(monthStart);
                                                const endDate = endOfWeek(monthEnd);
                                                const days = eachDayOfInterval({ start: startDate, end: endDate });

                                                return days.map((day, i) => {
                                                    const isSelected = isSameDay(day, rosterDates[selectedDayIndex]);
                                                    const isCurrentMonth = isSameMonth(day, monthStart);
                                                    const isToday = isSameDay(day, new Date());

                                                    // Find if this day exists in current roster range
                                                    const rosterIndex = rosterDates.findIndex(rd => isSameDay(rd, day));

                                                    return (
                                                        <button
                                                            key={i}
                                                            onClick={() => {
                                                                if (rosterIndex !== -1) {
                                                                    setSelectedDayIndex(rosterIndex);
                                                                    setIsCalendarExpanded(false);
                                                                    // Scroll day picker
                                                                    setTimeout(() => {
                                                                        document.getElementById(`day-btn-${rosterIndex}`)?.scrollIntoView({ behavior: 'smooth', inline: 'center' });
                                                                    }, 100);
                                                                } else {
                                                                    // If not in range, we could update offset, but for now just show toast
                                                                    toast.info(`Selection jumps to ${format(day, "MMM d")}. Update roster period to view.`);
                                                                }
                                                            }}
                                                            className={cn(
                                                                "h-10 w-full flex items-center justify-center rounded-lg text-sm transition-all",
                                                                isSelected
                                                                    ? "bg-[hsl(var(--brand))] text-white font-bold shadow-sm"
                                                                    : isToday
                                                                        ? "text-[hsl(var(--brand))] font-bold bg-[hsl(var(--brand-light))]/20"
                                                                        : isCurrentMonth ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]/40",
                                                                rosterIndex === -1 && isCurrentMonth && "opacity-40"
                                                            )}
                                                        >
                                                            {day.getDate()}
                                                        </button>
                                                    );
                                                });
                                            })()}
                                        </div>

                                        {/* Drag Handle */}
                                        <div className="flex justify-center mt-4">
                                            <div className="w-12 h-1 rounded-full bg-[hsl(var(--muted))]" />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Day Selector (Horizontal) */}
                        {!isCalendarExpanded && (
                            <div className="flex flex-col sticky top-0 z-10 bg-white">
                                <div className="flex overflow-x-auto p-3 no-scrollbar gap-2">
                                    {rosterDates.map((d, i) => {
                                        const isSelected = selectedDayIndex === i;
                                        const isToday = formatDate(d) === formatDate(new Date());
                                        const dayName = d.toLocaleDateString("en-AU", { weekday: "short" });
                                        const dayNum = d.getDate();

                                        const todayMidnight = new Date();
                                        todayMidnight.setHours(0, 0, 0, 0);
                                        const dMidnight = new Date(d);
                                        dMidnight.setHours(0, 0, 0, 0);
                                        const isPastDay = dMidnight < todayMidnight;

                                        return (
                                            <button
                                                key={i}
                                                id={`day-btn-${i}`}
                                                onClick={() => setSelectedDayIndex(i)}
                                                className={cn(
                                                    "flex flex-col items-center justify-center min-w-[56px] h-14 rounded-xl transition-all shrink-0",
                                                    isSelected
                                                        ? "bg-[hsl(var(--brand))] text-white shadow-md shadow-[hsl(var(--brand))]/20 scale-105"
                                                        : "bg-[hsl(var(--muted))]/10 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/20",
                                                    isToday && !isSelected && "ring-2 ring-[hsl(var(--brand))]/30",
                                                    isPastDay && !isSelected && "opacity-75 bg-[hsl(var(--muted))]/15"
                                                )}
                                            >
                                                <span className="text-[9px] uppercase font-black tracking-tighter opacity-70">{dayName}</span>
                                                <span className="text-base font-black leading-tight">{dayNum}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Shifts List for selected day */}
                        <div className="flex-1 p-4 space-y-4 pb-24">
                            {(() => {
                                const selectedDateStr = formatDate(rosterDates[selectedDayIndex]);
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const selectedDateObj = new Date(rosterDates[selectedDayIndex]);
                                selectedDateObj.setHours(0, 0, 0, 0);
                                const isPastDay = selectedDateObj < today;

                                // Filter employees based on search/role (already handled by paginatedEmployees)
                                const activeEmployees = paginatedEmployees;

                                const dayDrafts = employees.reduce((acc: any, emp: any) => {
                                    const shifts = shiftGrid[emp.employee_id]?.[selectedDateStr] || [];
                                    return acc + shifts.filter((s: any) => s.shift_status === 'draft').length;
                                }, 0);

                                return (
                                    <>
                                        {/* Mobile Search/Filter (Centered, above employee list header) */}
                                        <div className="sm:hidden flex flex-col items-center justify-center gap-3 mt-2 mb-6">
                                            {!isSearchExpanded ? (
                                                <div className="flex items-center justify-center gap-4 w-full">
                                                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl bg-white shadow-sm border-[hsl(var(--border))]" onClick={() => setIsSearchExpanded(true)}>
                                                        <Search size={16} className="text-[hsl(var(--muted-foreground))]" />
                                                    </Button>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="outline" className="h-10 rounded-xl gap-2 px-4 bg-white border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/30 text-xs shadow-sm focus:ring-2 focus:ring-[hsl(var(--brand))]/10">
                                                                <Filter size={14} className="text-[hsl(var(--muted-foreground))]" />
                                                                <span className="font-semibold">{roleFilter === 'all' ? 'All Roles' : (roleFilter === 'manager' ? 'Managers' : 'Staff')}</span>
                                                                <ChevronDown size={14} className="opacity-50" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="center" className="w-48 rounded-2xl shadow-xl p-1.5 border-[hsl(var(--border))] animate-in fade-in zoom-in-95 duration-200">
                                                            <DropdownMenuItem onClick={() => { setRoleFilter("all"); setCurrentPage(1); }} className={cn("cursor-pointer font-medium text-xs rounded-lg py-2 transition-all", roleFilter === "all" && "bg-[hsl(var(--brand-light))]/50 text-[hsl(var(--brand))]")}>All Roles</DropdownMenuItem>
                                                            <DropdownMenuSeparator className="my-1" />
                                                            {roles.map(r => (
                                                                <DropdownMenuItem
                                                                    key={r}
                                                                    onClick={() => { setRoleFilter(r.toLowerCase()); setCurrentPage(1); }}
                                                                    className={cn(
                                                                        "cursor-pointer font-medium text-xs rounded-lg py-2 transition-all",
                                                                        roleFilter === r.toLowerCase() && "bg-[hsl(var(--brand-light))]/50 text-[hsl(var(--brand))]"
                                                                    )}
                                                                >
                                                                    {r === 'manager' ? 'Managers' : r === 'employee' ? 'Staff' : r.split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')}
                                                                </DropdownMenuItem>
                                                            ))}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            ) : (
                                                <div className="flex items-center w-full gap-2 relative">
                                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                                                    <Input
                                                        placeholder="Search employee..."
                                                        className="pl-9 h-10 w-full bg-white border-[hsl(var(--border))] rounded-xl focus:ring-2 focus:ring-[hsl(var(--brand))]/10 pr-10 shadow-sm"
                                                        value={searchQuery}
                                                        autoFocus
                                                        onChange={(e) => {
                                                            setSearchQuery(e.target.value);
                                                            setCurrentPage(1);
                                                        }}
                                                    />
                                                    <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent" onClick={() => { setIsSearchExpanded(false); setSearchQuery(""); }}>
                                                        <X size={14} className="text-[hsl(var(--muted-foreground))]" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Day Header/Actions */}
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-[10px] sm:text-sm font-black uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                                                {activeEmployees.length} {activeEmployees.length === 1 ? 'Employee' : 'Employees'}
                                            </h3>
                                            {dayDrafts > 0 && !isPastDay && (
                                                <Button
                                                    size="sm"
                                                    variant="success"
                                                    className="h-7 text-[10px] font-black uppercase tracking-wider px-2"
                                                    onClick={() => publishRosterMutation.mutate(currentRoster.roster_id)}
                                                >
                                                    Publish {dayDrafts} Shift{dayDrafts > 1 ? 's' : ''}
                                                </Button>
                                            )}
                                        </div>

                                        {activeEmployees.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                                <CalendarDays size={48} className="text-[hsl(var(--muted-foreground))]/20 mb-4" />
                                                <p className="text-[hsl(var(--muted-foreground))] font-medium">No employees found</p>
                                            </div>
                                        ) : (
                                            activeEmployees.map((emp: any) => {
                                                const dayShifts = shiftGrid[emp.employee_id]?.[selectedDateStr] || [];

                                                return (
                                                    <div key={emp.employee_id} className="space-y-3 p-4 rounded-2xl border border-[hsl(var(--border))] bg-white shadow-sm">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-9 w-9 rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] font-black flex items-center justify-center text-xs shadow-sm shadow-[hsl(var(--brand))]/10 border border-[hsl(var(--brand))]/10">
                                                                    {emp.first_name?.[0]}{emp.last_name?.[0]}
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-black text-[hsl(var(--foreground))]">{emp.first_name} {emp.last_name}</span>
                                                                    <span className="text-[10px] uppercase font-bold tracking-widest text-[hsl(var(--muted-foreground))]">{emp.role === 'manager' ? 'Manager' : 'Staff'}</span>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 rounded-full text-[hsl(var(--brand))] hover:bg-[hsl(var(--brand))]/10"
                                                                onClick={() => openAddShift(selectedDateStr, emp.employee_id)}
                                                            >
                                                                <Plus size={18} />
                                                            </Button>
                                                        </div>

                                                        <div className="grid grid-cols-1 gap-3">
                                                            {dayShifts.length > 0 ? (
                                                                dayShifts.map((s: any) => {
                                                                    const isPublished = s.shift_status === 'published';
                                                                    return (
                                                                        <div
                                                                            key={s.shift_id}
                                                                            onClick={() => openAddShift(selectedDateStr, emp.employee_id, s)}
                                                                            className={cn(
                                                                                "p-3 rounded-xl border transition-all active:scale-[0.98] relative overflow-hidden flex items-center justify-between shadow-sm",
                                                                                isPublished
                                                                                    ? isPastDay ? "bg-[#C8E6C9]/60 border-[#A5D6A7] text-green-900 opacity-90" : "bg-[#F1F8E9] border-[#C5E1A5] text-green-900"
                                                                                    : isPastDay ? "bg-[#EEEEEE] border-[#BDBDBD] text-gray-800 opacity-90" : "bg-white border-[hsl(var(--border))] text-[hsl(var(--foreground))]"
                                                                            )}
                                                                        >
                                                                            <div className="flex flex-col gap-0.5">
                                                                                <div className="flex items-center gap-2">
                                                                                    <Clock size={12} className={cn("opacity-60", isPublished ? "text-green-700" : "text-[hsl(var(--brand))]")} />
                                                                                    <span className="text-sm font-black tracking-tight tabular-nums flex items-center gap-1">
                                                                                        {s.start_time?.split('T')[1]?.substring(0, 5)}
                                                                                        {" – "}
                                                                                        {s.end_time?.split('T')[1]?.substring(0, 5)}
                                                                                        {s.start_time && s.end_time && (
                                                                                            <span className="text-xs opacity-60 ml-0.5 font-bold">
                                                                                                ({formatDurationHours(calculateShiftDuration(s.start_time.split('T')[1]?.substring(0, 5) || "00:00", s.end_time.split('T')[1]?.substring(0, 5) || "00:00"))})
                                                                                            </span>
                                                                                        )}
                                                                                    </span>
                                                                                </div>
                                                                                <Badge variant="secondary" className={cn(
                                                                                    "text-[8px] uppercase font-black tracking-widest h-4 w-min whitespace-nowrap",
                                                                                    isPastDay ? "bg-gray-300 text-gray-800" : isPublished ? "bg-green-200 text-green-900" : "bg-orange-100 text-orange-900"
                                                                                )}>
                                                                                    {s.shift_type}
                                                                                </Badge>
                                                                            </div>
                                                                            <div className={cn(
                                                                                "flex h-7 w-7 items-center justify-center rounded-lg transition-colors shadow-sm",
                                                                                isPastDay ? "bg-slate-400 text-white" : isPublished ? "bg-green-500 text-white" : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                                                                            )}>
                                                                                {isPublished ? <CheckCircle2 size={14} /> : <FileText size={14} />}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })
                                                            ) : (
                                                                <div
                                                                    onClick={() => openAddShift(selectedDateStr, emp.employee_id)}
                                                                    className="p-3 rounded-xl border border-dashed border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] text-[10px] font-bold italic flex items-center justify-center gap-2 hover:bg-[hsl(var(--brand))]/5 transition-colors cursor-pointer bg-white/50"
                                                                >
                                                                    <Plus size={12} />
                                                                    Assign shift
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </>
                                );
                            })()}
                        </div>

                        {/* Floating Action Button (FAB) for adding shifts */}
                        <Button
                            onClick={() => openAddShift(formatDate(rosterDates[selectedDayIndex]), "")}
                            className="fixed bottom-24 right-6 size-10 lg:h-9 lg:w-auto p-0 lg:px-4 lg:py-2 gap-2 shadow-2xl shadow-[hsl(var(--brand))]/40 lg:shadow-md hover:shadow-lg transition-all lg:ml-2 rounded-full lg:rounded-lg z-50 lg:static"
                        >
                            <Plus size={24} className="lg:w-4 lg:h-4" />
                            <span className="hidden lg:inline">Add Shift</span>
                        </Button>
                    </div>
                ) : (
                    /* DESKTOP GRID VIEW */
                    <div className={cn(
                        "overflow-y-auto w-full max-h-[calc(100vh-320px)] scrollbar-thin",
                        (rosterPeriod === "monthly" || rosterPeriod === "fortnightly") ? "overflow-x-hidden" : "overflow-x-auto"
                    )}>
                        <table className={cn(
                            "w-full text-sm border-separate border-spacing-0",
                            (rosterPeriod === "monthly" || rosterPeriod === "fortnightly") ? "table-fixed" : ""
                        )}>
                            <thead className="sticky top-0 z-40">
                                <tr className="bg-[hsl(var(--muted))]">
                                    <th className={cn(
                                        "sticky left-0 top-0 z-50 bg-[hsl(var(--muted))] py-4 font-bold text-[hsl(var(--muted-foreground))] border-b border-r border-[hsl(var(--border))] shadow-[inset_-1px_-1px_0_hsl(var(--border))] text-center",
                                        rosterPeriod === "monthly" ? "w-14 min-w-14 px-1" : "w-48 min-w-48 px-4"
                                    )}>
                                        <Users size={16} className="mx-auto opacity-70" />
                                    </th>
                                    {rosterDates.map((d, i) => {
                                        const isToday = formatDate(d) === formatDate(new Date());
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        const dMidnight = new Date(d);
                                        dMidnight.setHours(0, 0, 0, 0);
                                        const isPast = dMidnight < today;
                                        const dayName = d.toLocaleDateString("en-AU", { weekday: "short" });

                                        return (
                                            <th
                                                key={i}
                                                className={cn(
                                                    "px-1 py-4 text-center font-bold border-b border-l border-[hsl(var(--border))] first:border-l-0 last:border-r-0 transition-colors",
                                                    isToday ? "text-[hsl(var(--brand))] bg-[hsl(var(--brand-light))]/30" : "text-[hsl(var(--muted-foreground))]",
                                                    isPast && !isToday && "opacity-75 bg-[hsl(var(--muted))]/15"
                                                )}
                                                style={{
                                                    minWidth: (rosterPeriod === "monthly" || rosterPeriod === "fortnightly") ? "0" : "140px",
                                                    width: (rosterPeriod === "monthly" || rosterPeriod === "fortnightly") ? `${100 / (rosterDates.length + 2)}%` : "auto"
                                                }}
                                            >
                                                {(rosterPeriod === "monthly" || rosterPeriod === "fortnightly") ? (
                                                    <div className="flex flex-col items-center">
                                                        <div className="text-[9px] uppercase tracking-tighter opacity-50 font-black">{dayName}</div>
                                                        <div className="text-[11px] font-black">{d.getDate()}</div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">{dayName}</div>
                                                        <div className="text-sm font-black">{d.getDate()}</div>
                                                    </>
                                                )}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <Reorder.Group
                                as="tbody"
                                axis="y"
                                values={paginatedEmployees.map(e => e.employee_id)}
                                onReorder={(newOrder) => {
                                    // Update only the current page's order in the main list
                                    const start = (currentPage - 1) * pageSize;
                                    const updated = [...orderedEmployeeIds];
                                    const pageIds = paginatedEmployees.map(e => e.employee_id);
                                    const firstIndex = updated.indexOf(pageIds[0]);
                                    if (firstIndex !== -1) {
                                        updated.splice(firstIndex, pageIds.length, ...newOrder);
                                        setOrderedEmployeeIds(updated);
                                        try {
                                            localStorage.setItem("roster_employee_order", JSON.stringify(updated));
                                        } catch (e) {
                                            console.error("Failed to save employee order to localStorage:", e);
                                        }
                                    }
                                }}
                                className="relative"
                            >
                                {paginatedEmployees.length === 0 ? (
                                    <tr>
                                        <td colSpan={rosterDates.length + 1} className="px-4 py-12 text-center text-[hsl(var(--muted-foreground))] bg-white">
                                            No employees found matching your filters.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedEmployees.map((emp: any) => (
                                        <Reorder.Item
                                            as="tr"
                                            key={emp.employee_id}
                                            value={emp.employee_id}
                                            dragListener={true}
                                            className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/30 transition-colors bg-white group"
                                        >
                                            <td className={cn(
                                                "sticky left-0 z-30 bg-white group-hover:bg-[hsl(var(--muted))]/30 py-3 border-r border-[hsl(var(--border))] shadow-[inset_-1px_0_0_hsl(var(--border))]",
                                                rosterPeriod === "monthly" ? "w-14 px-0.5" : "px-4"
                                            )}>
                                                <div className={cn(
                                                    "flex items-center group/profile gap-2",
                                                    rosterPeriod === "monthly" ? "justify-center relative" : ""
                                                )}>
                                                    {/* Grip Icon (Only for non-monthly) */}
                                                    {rosterPeriod !== "monthly" && (
                                                        <div className="cursor-grab active:cursor-grabbing text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                            <GripVertical size={14} />
                                                        </div>
                                                    )}

                                                    {/* Profile Avatar */}
                                                    <div className={cn(
                                                        "shrink-0 items-center justify-center rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] font-bold shadow-sm flex transition-all",
                                                        rosterPeriod === "monthly" ? "h-9 w-9 text-xs" : "h-8 w-8 text-xs"
                                                    )}>
                                                        {emp.first_name?.[0]}{emp.last_name?.[0]}
                                                    </div>

                                                    {/* Name and Role (Identification Message Bubble - Reveals strictly on profile hover) */}
                                                    <div className={cn(
                                                        "flex flex-col min-w-0 transition-all",
                                                        rosterPeriod === "monthly"
                                                            ? "absolute left-[calc(100%-14px)] z-50 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl p-3 px-4 opacity-0 group-hover/profile:opacity-100 group-hover/profile:visible pointer-events-none scale-90 group-hover/profile:scale-100 transform origin-left min-w-[160px] invisible animate-in fade-in slide-in-from-left-2 duration-200"
                                                            : ""
                                                    )}>
                                                        {/* Message bubble tail (carets) */}
                                                        {rosterPeriod === "monthly" && (
                                                            <div className="absolute top-1/2 -left-2 -translate-y-1/2 w-4 h-4 bg-[hsl(var(--card))] border-l border-b border-[hsl(var(--border))] rotate-45 rounded-sm" />
                                                        )}

                                                        <span className={cn(
                                                            "font-bold truncate text-[hsl(var(--foreground))] relative z-10",
                                                            rosterPeriod === "monthly" ? "text-xs mb-0.5" : "text-sm"
                                                        )}>{emp.first_name} {emp.last_name}</span>
                                                        <span className={cn(
                                                            "font-black uppercase tracking-widest relative z-10",
                                                            rosterPeriod === "monthly" ? "text-[8px] text-[hsl(var(--brand))]" : "text-[10px] text-[hsl(var(--muted-foreground))]"
                                                        )}>{emp.role === 'manager' ? 'Manager' : 'Staff'}</span>
                                                    </div>

                                                    {/* Actions Menu - Always on hover, kept compact within column */}
                                                    <div className={cn(
                                                        "shrink-0",
                                                        rosterPeriod === "monthly" ? "absolute right-0 z-10" : ""
                                                    )}>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className={cn(
                                                                        "h-7 w-7 rounded-full transition-all opacity-0 group-hover/profile:opacity-100 ring-2 ring-transparent group-hover/profile:ring-[hsl(var(--brand))]/10 hover:bg-transparent hover:text-blue-600",
                                                                        rosterPeriod === "monthly" && "h-5 w-5"
                                                                    )}
                                                                >
                                                                    <MoreHorizontal size={rosterPeriod === "monthly" ? 12 : 14} className="text-[hsl(var(--muted-foreground))] hover:text-blue-600" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent
                                                                align="end"
                                                                side="bottom"
                                                                sideOffset={8}
                                                                className="min-w-[140px] p-1 bg-white/95 backdrop-blur-md border-[hsl(var(--border))] rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200"
                                                            >
                                                                <DropdownMenuItem asChild className="focus:bg-transparent focus:text-blue-600 data-highlighted:bg-transparent data-highlighted:text-blue-600">
                                                                    <Link
                                                                        href={`/owner/employees/${emp.employee_id}`}
                                                                        className="font-bold text-[10px] uppercase tracking-[0.15em] cursor-pointer w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl hover:text-blue-600 transition-all group/action"
                                                                    >
                                                                        View Profile
                                                                        <div className="opacity-0 group-hover/action:opacity-100 -translate-x-2 group-hover/action:translate-x-0 transition-all">
                                                                            →
                                                                        </div>
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </div>
                                            </td>
                                            {rosterDates.map((d, i) => {
                                                const dateStr = formatDate(d);
                                                const dayShifts = shiftGrid[emp.employee_id]?.[dateStr] || [];
                                                const today = new Date();
                                                today.setHours(0, 0, 0, 0);
                                                const dMidnight = new Date(d);
                                                dMidnight.setHours(0, 0, 0, 0);
                                                const isPast = dMidnight < today;
                                                const isAvailable = availability.find((a: any) => a.employee_id === emp.employee_id && a.date === dateStr)?.is_available !== false;
                                                const availRecord = availability.find((a: any) => a.employee_id === emp.employee_id && a.date === dateStr);

                                                return (
                                                    <td
                                                        key={dateStr}
                                                        className={cn(
                                                            "border-b border-l border-[hsl(var(--border))] align-top transition-colors relative group/cell",
                                                            rosterPeriod === "monthly" ? "p-1 min-w-0" : "p-2 min-w-[140px]",
                                                            formatDate(d) === formatDate(new Date()) ? "bg-[hsl(var(--brand-light))]/5" : "",
                                                            isPast ? "bg-[hsl(var(--muted))]/15 opacity-85 pointer-events-auto" : (!isAvailable ? "bg-[hsl(var(--danger))]/5" : "hover:bg-[hsl(var(--brand))]/5"),
                                                            "transition-opacity"
                                                        )}
                                                        title={!isAvailable ? "Not Available" : undefined}
                                                        onClick={() => {
                                                            if (isPast || rosterPeriod === "monthly") return;
                                                            if (!isAvailable) {
                                                                toast.error("Employee is unavailable on this date");
                                                                return;
                                                            }
                                                            openAddShift(dateStr, emp.employee_id);
                                                        }}
                                                    >
                                                        {/* Unavailable indicator */}
                                                        {!isAvailable && dayShifts.length === 0 && (
                                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                                                                <span className="text-[12px] font-bold text-[hsl(var(--danger))] uppercase tracking-widest">N/A</span>
                                                            </div>
                                                        )}

                                                        {/* Availability time badge */}
                                                        {isAvailable && availRecord?.available_from && rosterPeriod !== "monthly" && (
                                                            <div className="flex flex-col gap-0 px-1.5 py-1 rounded-md bg-[hsl(var(--brand-light))]/50 border border-[hsl(var(--brand))]/25 w-fit mt-1 mb-0.5">
                                                                <span className="text-[8px] font-black uppercase tracking-widest text-[hsl(var(--brand))]/70 leading-none mb-0.5">Avail. Time</span>
                                                                <span className="text-[10px] font-bold tabular-nums text-[hsl(var(--brand))] leading-none">
                                                                    {availRecord.available_from?.substring(0, 5)} – {availRecord.available_to?.substring(0, 5)}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {isAvailable && !availRecord?.available_from && availRecord && rosterPeriod !== "monthly" && (
                                                            <div className="flex flex-col gap-0 px-1.5 py-1 rounded-md bg-[hsl(var(--success-light))]/40 border border-[hsl(var(--success))]/20 w-fit mt-1 mb-0.5">
                                                                <span className="text-[8px] font-black uppercase tracking-widest text-[hsl(var(--success))]/80 leading-none mb-0.5">Avail. Time</span>
                                                                <span className="text-[10px] font-bold text-[hsl(var(--success))] leading-none">All Day</span>
                                                            </div>
                                                        )}

                                                        {/* Hover Plus Icon for Quick Add - Only for empty cells */}
                                                        {!isPast && isAvailable && dayShifts.length === 0 && (
                                                            <button
                                                                className="absolute top-1 right-1 z-10 p-0.5 rounded-md bg-[hsl(var(--brand))] text-white opacity-0 group-hover/cell:opacity-100 transition-opacity shadow-sm hover:scale-110 active:scale-95"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openAddShift(dateStr, emp.employee_id);
                                                                }}
                                                            >
                                                                <Plus size={10} strokeWidth={4} />
                                                            </button>
                                                        )}

                                                        {dayShifts.length > 0 && (
                                                            <div className={cn(
                                                                "flex flex-col gap-1 w-full h-full py-1",
                                                                rosterPeriod === "monthly" ? "min-h-[64px]" : "min-h-[72px]"
                                                            )}>
                                                                {dayShifts.map((s: any) => {
                                                                    const isPublished = s.shift_status === 'published';
                                                                    // Extract time directly from ISO string to avoid timezone conversion
                                                                    const startTimeStr = s.start_time?.split('T')[1]?.substring(0, 5) || "00:00";
                                                                    const endTimeStr = s.end_time?.split('T')[1]?.substring(0, 5) || "00:00";

                                                                    return (
                                                                        <div
                                                                            key={s.shift_id}
                                                                            className={cn(
                                                                                "rounded-lg px-2 py-1.5 font-bold mb-1 transition-all cursor-pointer border relative group/shift overflow-hidden flex flex-col h-full min-h-[64px] shadow-sm",
                                                                                isPublished
                                                                                    ? isPast ? "bg-[#C8E6C9]/70 border-[#A5D6A7] text-green-900 opacity-90" : "bg-[#E8F5E9] border-[#C8E6C9] text-green-900"
                                                                                    : isPast ? "bg-[#EEEEEE] border-[#BDBDBD] text-gray-800 opacity-90" : "bg-[#F5F5F5] border-[#E0E0E0] text-gray-700",
                                                                                !isPast && "hover:shadow-md hover:-translate-y-0.5"
                                                                            )}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                openAddShift(dateStr, emp.employee_id, s);
                                                                            }}
                                                                        >
                                                                            <div className="flex flex-col gap-0.5">
                                                                                <span className="text-[10px] leading-none uppercase tabular-nums">
                                                                                    {startTimeStr}
                                                                                </span>
                                                                                <span className="text-[10px] leading-none uppercase tabular-nums">
                                                                                    {endTimeStr}
                                                                                </span>
                                                                                <span className="text-[9px] font-black mt-1 text-[hsl(var(--muted-foreground))]">
                                                                                    ({formatDurationHours(calculateShiftDuration(startTimeStr, endTimeStr))})
                                                                                </span>
                                                                            </div>

                                                                            <div className="mt-auto flex items-end justify-between gap-1">
                                                                                <span className="text-[9px] font-black uppercase tracking-tighter truncate block opacity-80 mb-0.5">
                                                                                    {s.shift_type}
                                                                                </span>
                                                                                {getShiftProgress(s.shift_id) && (
                                                                                    <div className="flex items-center gap-1.5 shrink-0 bg-white/50 px-1 py-0.5 rounded-md border border-black/5 shadow-sm mb-0.5">
                                                                                        <div className="relative w-3.5 h-3.5">
                                                                                            <svg className="w-full h-full" viewBox="0 0 100 100">
                                                                                                <circle className="text-slate-200" strokeWidth="20" stroke="currentColor" fill="transparent" r="40" cx="50" cy="50" />
                                                                                                <circle
                                                                                                    className={cn(
                                                                                                        getShiftProgress(s.shift_id)?.allRequiredDone ? "text-emerald-500" : "text-[hsl(var(--brand))]"
                                                                                                    )}
                                                                                                    strokeWidth="20"
                                                                                                    strokeDasharray={251.2}
                                                                                                    strokeDashoffset={251.2 - (251.2 * (getShiftProgress(s.shift_id)?.percent || 0)) / 100}
                                                                                                    strokeLinecap="round"
                                                                                                    stroke="currentColor"
                                                                                                    fill="transparent"
                                                                                                    r="40" cx="50" cy="50"
                                                                                                />
                                                                                            </svg>
                                                                                        </div>
                                                                                        <span className={cn(
                                                            "text-[8px] font-black tabular-nums",
                                                            getShiftProgress(s.shift_id)?.allRequiredDone ? "text-emerald-700" : "text-slate-600"
                                                        )}>
                                                            {getShiftProgress(s.shift_id)?.total}
                                                        </span>
                                                                                    </div>
                                                                                )}
                                                                            </div>

                                                                            {/* Bottom Accent Bar as requested in reference image */}
                                                                            <div className={cn(
                                                                                "absolute bottom-0 left-0 right-0 h-1.5",
                                                                                isPast ? "bg-slate-400" : isPublished ? "bg-green-500" : "bg-red-500"
                                                                            )} />
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </Reorder.Item>
                                    ))
                                )}
                            </Reorder.Group>
                        </table>
                    </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 bg-[hsl(var(--muted))]/20 border-t border-[hsl(var(--border))] gap-4 sm:gap-0">
                        <div className="text-xs text-[hsl(var(--muted-foreground))] font-medium">
                            Showing <span className="text-[hsl(var(--foreground))] font-bold">{Math.min(filteredEmployees.length, (currentPage - 1) * pageSize + 1)}</span> to <span className="text-[hsl(var(--foreground))] font-bold">{Math.min(filteredEmployees.length, currentPage * pageSize)}</span> of <span className="text-[hsl(var(--foreground))] font-bold">{filteredEmployees.length}</span> employees
                        </div>
                        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-2 sm:pb-0 scrollbar-none">
                            <Button
                                variant="outline"
                                size="icon"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(1)}
                                className="h-8 w-8 rounded-lg border-[hsl(var(--border))] shrink-0"
                            >
                                <ChevronsLeft size={14} />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(currentPage - 1)}
                                className="h-8 w-8 rounded-lg border-[hsl(var(--border))] shrink-0"
                            >
                                <ChevronLeft size={14} />
                            </Button>

                            <div className="flex items-center gap-1 mx-1 shrink-0">
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter(p => {
                                        if (isMobile) return Math.abs(p - currentPage) <= 0; // Only show current page on mobile
                                        return p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1;
                                    })
                                    .map((p, i, arr) => {
                                        if (i > 0 && p !== arr[i - 1] + 1) {
                                            return <span key={`dots-${p}`} className="text-[hsl(var(--muted-foreground))]">...</span>;
                                        }
                                        return (
                                            <button
                                                key={p}
                                                onClick={() => setCurrentPage(p)}
                                                className={cn(
                                                    "h-8 w-8 text-xs font-bold rounded-lg transition-all",
                                                    currentPage === p
                                                        ? "bg-[hsl(var(--brand))] text-white"
                                                        : "hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"
                                                )}
                                            >
                                                {isMobile ? `Page ${p}` : p}
                                            </button>
                                        );
                                    })}
                            </div>

                            <Button
                                variant="outline"
                                size="icon"
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage(currentPage + 1)}
                                className="h-8 w-8 rounded-lg border-[hsl(var(--border))] shrink-0"
                            >
                                <ChevronRight size={14} />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage(totalPages)}
                                className="h-8 w-8 rounded-lg border-[hsl(var(--border))] shrink-0"
                            >
                                <ChevronsRight size={14} />
                            </Button>
                        </div>
                    </div>
                )}
                <Dialog open={addShiftOpen} onOpenChange={setAddShiftOpen}>
                    <DialogContent className="max-w-md sm:max-w-xl p-0 overflow-hidden rounded-2xl border-none shadow-2xl bg-white">
                        <Tabs defaultValue="details" className="w-full">
                            <div className="bg-slate-50 border-b border-slate-100 px-6 pt-6 pb-2">
                                <DialogHeader className="mb-4">
                                    <DialogTitle className="text-2xl font-bold flex items-center justify-between">
                                        <span>{editingShiftId ? "Edit Shift" : "Add New Shift"}</span>
                                        {editingShiftId && (
                                            <Badge variant="secondary" className={cn(
                                                "ml-2 text-[10px] font-black uppercase tracking-widest px-2 py-0.5",
                                                shifts.find((s: any) => s.shift_id === editingShiftId)?.shift_status === 'published'
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : "bg-amber-100 text-amber-700"
                                            )}>
                                                {shifts.find((s: any) => s.shift_id === editingShiftId)?.shift_status || 'Draft'}
                                            </Badge>
                                        )}
                                    </DialogTitle>
                                    <DialogDescription>
                                        {editingShiftId ? "Update shift details or manage its checklist." : "Assign a shift to an employee."}
                                    </DialogDescription>
                                </DialogHeader>

                                <TabsList className="grid w-full grid-cols-2 h-10 p-1 bg-slate-200/50 rounded-xl">
                                    <TabsTrigger value="details" className="rounded-lg font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                        <Clock size={14} className="mr-2" />
                                        Details
                                    </TabsTrigger>
                                    <TabsTrigger value="checklist" disabled={!editingShiftId} className="rounded-lg font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                        <ClipboardList size={14} className="mr-2" />
                                        Checklist
                                        {shiftChecklist.length > 0 && (
                                            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-[hsl(var(--brand))] text-white text-[9px]">
                                                {shiftChecklist.length}
                                            </span>
                                        )}
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <TabsContent value="details" className="p-6 m-0 flex flex-col h-[480px]">
                                <div className="space-y-4 py-2 flex-1 overflow-y-auto pr-1">
                                    <Input
                                        label="Shift Date"
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        disabled={isEditingShiftLocked}
                                    />
                                    <EmployeeSearchPicker
                                        employees={activeEmployees}
                                        value={shiftEmployee}
                                        onChange={(id) => setShiftEmployee(id)}
                                        disabled={isEditingShiftLocked}
                                    />

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5 relative">
                                            <label className="text-sm font-medium">Start Time</label>
                                            <button
                                                type="button"
                                                onClick={() => !isEditingShiftLocked && setIsStartDropdownOpen(!isStartDropdownOpen)}
                                                disabled={isEditingShiftLocked}
                                                className={cn(
                                                    "flex h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm items-center justify-between focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20 focus:border-[hsl(var(--brand))]",
                                                    isEditingShiftLocked && "opacity-50 cursor-not-allowed"
                                                )}
                                            >
                                                <span>{shiftStart}</span>
                                                <Clock size={14} className="text-[hsl(var(--muted-foreground))]" />
                                            </button>

                                            {isStartDropdownOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-60" onClick={() => setIsStartDropdownOpen(false)} />
                                                    <div className="absolute top-full mb-2 left-0 w-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-2xl z-61 overflow-hidden flex flex-col animate-in slide-in-from-bottom-2 duration-200">
                                                        <div className="p-2 border-b bg-[hsl(var(--muted))]/30 sticky top-0">
                                                            <input
                                                                autoFocus
                                                                type="text"
                                                                placeholder="Search..."
                                                                value={timeSearch}
                                                                onChange={e => setTimeSearch(e.target.value)}
                                                                className="w-full h-8 px-2 text-[10px] rounded-md border bg-[hsl(var(--background))]"
                                                            />
                                                        </div>
                                                        <div className="max-h-48 overflow-y-auto p-1">
                                                            {TIME_OPTIONS.filter(t => t.includes(timeSearch)).map(time => (
                                                                <button
                                                                    key={time}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setShiftStart(time);
                                                                        setIsStartDropdownOpen(false);
                                                                        setTimeSearch("");
                                                                    }}
                                                                    className={cn(
                                                                        "w-full text-left px-3 py-2 text-xs rounded-lg transition-colors",
                                                                        shiftStart === time
                                                                            ? "bg-[hsl(var(--brand))] text-white"
                                                                            : "hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"
                                                                    )}
                                                                >
                                                                    {time}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <div className="space-y-1.5 relative">
                                            <label className="text-sm font-medium">End Time</label>
                                            <button
                                                type="button"
                                                onClick={() => !isEditingShiftLocked && setIsEndDropdownOpen(!isEndDropdownOpen)}
                                                disabled={isEditingShiftLocked}
                                                className={cn(
                                                    "flex h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm items-center justify-between focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20 focus:border-[hsl(var(--brand))]",
                                                    isEditingShiftLocked && "opacity-50 cursor-not-allowed"
                                                )}
                                            >
                                                <span>{shiftEnd}</span>
                                                <Clock size={14} className="text-[hsl(var(--muted-foreground))]" />
                                            </button>

                                            {isEndDropdownOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-60" onClick={() => setIsEndDropdownOpen(false)} />
                                                    <div className="absolute top-full mb-2 left-0 w-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-2xl z-61 overflow-hidden flex flex-col animate-in slide-in-from-bottom-2 duration-200">
                                                        <div className="p-2 border-b bg-[hsl(var(--muted))]/30 sticky top-0">
                                                            <input
                                                                autoFocus
                                                                type="text"
                                                                placeholder="Search..."
                                                                value={timeSearch}
                                                                onChange={e => setTimeSearch(e.target.value)}
                                                                className="w-full h-8 px-2 text-[10px] rounded-md border bg-[hsl(var(--background))]"
                                                            />
                                                        </div>
                                                        <div className="max-h-48 overflow-y-auto p-1">
                                                            {TIME_OPTIONS.filter(t => t.includes(timeSearch)).map(time => (
                                                                <button
                                                                    key={time}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setShiftEnd(time);
                                                                        setIsEndDropdownOpen(false);
                                                                        setTimeSearch("");
                                                                    }}
                                                                    className={cn(
                                                                        "w-full text-left px-3 py-2 text-xs rounded-lg transition-colors",
                                                                        shiftEnd === time
                                                                            ? "bg-[hsl(var(--brand))] text-white"
                                                                            : "hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"
                                                                    )}
                                                                >
                                                                    {time}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 items-center">
                                        <div className="space-y-1.5 bg-[hsl(var(--brand-light))]/10 p-3 rounded-xl border border-[hsl(var(--brand))]/10">
                                            <label className="text-[10px] font-black uppercase text-[hsl(var(--muted-foreground))] tracking-widest block mb-1">Shift Type</label>
                                            <button
                                                type="button"
                                                onClick={() => setIsShiftTypeModalOpen(true)}
                                                className="w-full flex items-center justify-between text-left focus:outline-none hover:opacity-85 transition-opacity"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Clock size={14} className="text-[hsl(var(--brand))]" />
                                                    <span className="text-sm font-bold capitalize text-[hsl(var(--foreground))]">
                                                        {shiftType}
                                                        {isShiftTypeOverridden && <span className="ml-1 text-[9px] font-black text-[hsl(var(--brand))] uppercase tracking-wider bg-[hsl(var(--brand-light))]/40 px-1.5 py-0.5 rounded">Custom</span>}
                                                    </span>
                                                </div>
                                                <ChevronDown size={14} className="text-slate-400" />
                                            </button>
                                        </div>
                                        <div className="space-y-1.5 bg-[hsl(var(--muted))]/30 p-3 rounded-xl border border-[hsl(var(--border))]">
                                            <label className="text-[10px] font-black uppercase text-[hsl(var(--muted-foreground))] tracking-widest block mb-1">Total Hours</label>
                                            <div className="flex items-center gap-2">
                                                <FileText size={14} className="text-[hsl(var(--muted-foreground))]" />
                                                <span className="text-sm font-bold text-[hsl(var(--foreground))]">{formatDurationHours(calculateShiftDuration(shiftStart, shiftEnd))}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <DialogFooter className="flex items-center justify-between sm:justify-between w-full pt-4 shrink-0 border-t border-slate-100/50 mt-4">
                                    <div className="flex items-center gap-2">
                                        {editingShiftId && (
                                            <Button
                                                variant="outline"
                                                disabled={isEditingShiftLocked}
                                                className="text-[hsl(var(--danger))] border-[hsl(var(--danger))]/20 hover:bg-[hsl(var(--danger))]/10 disabled:opacity-30"
                                                onClick={() => setDeleteConfirmOpen(true)}
                                                loading={deleteShiftMutation.isPending}
                                            >
                                                <Trash2 size={16} className="mr-2" /> Delete
                                            </Button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {editingShiftId && shifts.find((s: any) => s.shift_id === editingShiftId)?.shift_status === 'draft' && (
                                            <Button
                                                variant="outline"
                                                className="border-[hsl(var(--brand))] text-[hsl(var(--brand))] hover:bg-[hsl(var(--brand))]/10"
                                                onClick={() => notifyShiftMutation.mutate(editingShiftId)}
                                                loading={notifyShiftMutation.isPending}
                                                disabled={notifyShiftMutation.isPending}
                                            >
                                                Publish Shift
                                            </Button>
                                        )}
                                        <Button variant="outline" onClick={() => setAddShiftOpen(false)}>Cancel</Button>
                                        <Button
                                            onClick={handleAddShift}
                                            loading={createShiftMutation.isPending || updateShiftMutation.isPending}
                                            disabled={editingShiftId ? (!isDirty || isEditingShiftLocked) : false}
                                        >
                                            {editingShiftId ? 'Update Shift' : (
                                                <>
                                                    <Plus size={16} className="mr-2" /> Create Shift
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </DialogFooter>
                            </TabsContent>

                            <TabsContent value="checklist" className="p-6 m-0 flex flex-col h-[480px]">
                                <div className="flex items-center justify-between mb-4 shrink-0">
                                    <h3 className="font-bold text-sm">Tasks Snapshot</h3>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant={isTemplatesPanelOpen ? "secondary" : "outline"}
                                            size="sm"
                                            className={cn(
                                                "h-8 rounded-lg text-[10px] font-black uppercase transition-all duration-150",
                                                isTemplatesPanelOpen && "bg-slate-100 text-slate-900 border-slate-200"
                                            )}
                                            onClick={() => {
                                                if (!isTemplatesPanelOpen) {
                                                    setCollapsedTemplateCategories({});
                                                }
                                                setIsTemplatesPanelOpen(!isTemplatesPanelOpen);
                                            }}
                                        >
                                            {isTemplatesPanelOpen ? "Hide Templates" : "Attach Template"}
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="h-8 rounded-lg text-[10px] font-black uppercase"
                                            onClick={() => setIsAddTaskOpen(true)}
                                        >
                                            Add Task
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
                                    {/* Left pane: Checklist dropzone & tasks list */}
                                    <div
                                        className={cn(
                                            "flex-1 flex flex-col min-w-0 transition-all duration-200 rounded-2xl p-1 relative",
                                            isDraggingOverChecklist ? "bg-slate-50/80 border-2 border-dashed border-[hsl(var(--brand))]/30 scale-[0.99]" : "border-2 border-transparent"
                                        )}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            setIsDraggingOverChecklist(true);
                                        }}
                                        onDragLeave={() => {
                                            setIsDraggingOverChecklist(false);
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            setIsDraggingOverChecklist(false);
                                            const templateId = e.dataTransfer.getData("text/plain");
                                            if (templateId) {
                                                console.log('[RosterPage] Template dropped:', templateId);
                                                attachTemplateMutation.mutate([templateId]);
                                            }
                                        }}
                                    >
                                        {isDraggingOverChecklist && (
                                            <div className="absolute inset-0 bg-[hsl(var(--brand))]/5 pointer-events-none rounded-xl flex flex-col items-center justify-center gap-2 z-10 animate-fade-in">
                                                <div className="w-10 h-10 rounded-full bg-[hsl(var(--brand))]/10 flex items-center justify-center text-[hsl(var(--brand))]">
                                                    <ClipboardList size={20} />
                                                </div>
                                                <span className="text-xs font-bold text-[hsl(var(--brand))]">Drop template to attach</span>
                                            </div>
                                        )}

                                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                            {isLoadingChecklist ? (
                                                <div className="space-y-2 py-4">
                                                    {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />)}
                                                </div>
                                            ) : shiftChecklist.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100 h-full min-h-[220px]">
                                                    <ClipboardList size={32} className="text-slate-300 mb-2" />
                                                    <p className="text-xs font-bold text-slate-400">No tasks for this shift yet.</p>
                                                    <p className="text-[10px] text-slate-400 max-w-[180px] mt-1">Add tasks manually or attach a template.</p>
                                                </div>
                                            ) : (
                                                groupedChecklist.map((group) => {
                                                    const isCollapsed = collapsedGroups[group.id] === true;
                                                    return (
                                                        <div key={group.id} className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white mb-3">
                                                            <div className="w-full flex items-center justify-between px-4 py-2 bg-slate-50/50 hover:bg-slate-50 transition-colors border-b border-slate-100/50">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleGroup(group.id)}
                                                                    className="flex-1 flex items-center justify-between text-left focus:outline-none pr-4 py-1.5"
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-black uppercase text-slate-700 tracking-wider">
                                                                            {group.name}
                                                                        </span>
                                                                        <Badge variant="secondary" className="bg-slate-200/50 text-slate-600 text-[9px] font-black tracking-tight px-1.5 py-0.5 rounded-full">
                                                                            {group.items.length}
                                                                        </Badge>
                                                                    </div>
                                                                </button>
                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    {group.id !== 'custom' && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                removeTemplateTasksMutation.mutate(group.id);
                                                                            }}
                                                                            disabled={isEditingShiftLocked}
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </Button>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleGroup(group.id)}
                                                                        className="h-7 w-7 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none"
                                                                    >
                                                                        <ChevronDown
                                                                            size={16}
                                                                            className={cn("transition-transform duration-200", isCollapsed ? "" : "rotate-180")}
                                                                        />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {!isCollapsed && (
                                                                <div className="p-3 space-y-2 bg-white divide-y divide-slate-50">
                                                                    {group.items.map((item) => (
                                                                        <div key={item.checklist_item_id} className="group flex items-center gap-3 py-2.5 bg-white border border-transparent rounded-xl hover:border-[hsl(var(--brand))]/10 px-2 transition-all">
                                                                            <div className={cn(
                                                                                "w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 transition-all",
                                                                                item.status === 'done' ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-200 text-slate-100"
                                                                            )}>
                                                                                {item.status === 'done' ? <Check size={12} strokeWidth={4} /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />}
                                                                            </div>

                                                                            <div className="flex-1 min-w-0">
                                                                                <input
                                                                                    className="w-full bg-transparent border-none font-bold text-xs p-0 focus:ring-0 text-slate-700 placeholder-slate-400"
                                                                                    defaultValue={item.task_text}
                                                                                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                                                                    onBlur={(e) => {
                                                                                        if (e.target.value !== item.task_text) {
                                                                                            updateTaskMutation.mutate({
                                                                                                itemId: item.checklist_item_id,
                                                                                                data: { task_text: e.target.value }
                                                                                            });
                                                                                        }
                                                                                    }}
                                                                                />
                                                                                {item.instructions && (
                                                                                    <p className="text-[9px] text-slate-400 mt-0.5 leading-none font-medium">{item.instructions}</p>
                                                                                )}
                                                                            </div>

                                                                            <div className="flex items-center gap-3 shrink-0">
                                                                                <div className="flex flex-col items-center">
                                                                                    <span className="text-[8px] font-black uppercase text-slate-400 mb-0.5 tracking-wider">Req</span>
                                                                                    <Switch
                                                                                        checked={item.is_required}
                                                                                        onCheckedChange={(val) => {
                                                                                            updateTaskMutation.mutate({
                                                                                                itemId: item.checklist_item_id,
                                                                                                data: { is_required: val }
                                                                                            });
                                                                                        }}
                                                                                        className="scale-[0.55] data-[state=checked]:bg-[hsl(var(--brand))]"
                                                                                    />
                                                                                </div>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-7 w-7 rounded-full text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                    onClick={() => deleteTaskMutation.mutate(item.checklist_item_id)}
                                                                                >
                                                                                    <Trash2 size={14} />
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* Right pane: Scrollable and searchable templates sidebar */}
                                    {isTemplatesPanelOpen && (
                                        <div className="w-[210px] shrink-0 border-l border-slate-100 pl-4 flex flex-col h-full overflow-hidden animate-in slide-in-from-right-3 duration-200">
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2 shrink-0">Templates List</span>
                                            <div className="relative mb-2 shrink-0">
                                                <input
                                                    type="text"
                                                    placeholder="Search templates..."
                                                    value={templateSearchQuery}
                                                    onChange={(e) => setTemplateSearchQuery(e.target.value)}
                                                    className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-[hsl(var(--brand))] focus:border-[hsl(var(--brand))]"
                                                />
                                            </div>

                                            {/* Auto-filter Toggle checkbox */}
                                            <div className="flex items-center justify-between mb-2 shrink-0 px-1">
                                                <label className="flex items-center gap-1.5 cursor-pointer select-none text-[10px] font-bold text-slate-500 hover:text-slate-700">
                                                    <input
                                                        type="checkbox"
                                                        checked={isAutoFilterEnabled}
                                                        onChange={(e) => setIsAutoFilterEnabled(e.target.checked)}
                                                        className="h-3.5 w-3.5 rounded border-slate-300 text-[hsl(var(--brand))] focus:ring-[hsl(var(--brand))]"
                                                    />
                                                    Filter by shift ({shiftType})
                                                </label>
                                            </div>

                                            <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                                                {filteredTemplates.length === 0 ? (
                                                    <div className="p-3 text-center text-xs text-slate-400">No templates found</div>
                                                ) : (
                                                    CATEGORIES.map(cat => {
                                                        const catTemplates = templatesByCategory[cat.id] || [];
                                                        if (catTemplates.length === 0) return null;
                                                        const isCollapsed = collapsedTemplateCategories[cat.id] !== false;
                                                        return (
                                                            <div key={cat.id} className="space-y-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleTemplateCategory(cat.id)}
                                                                    className="w-full px-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 bg-slate-100/60 hover:bg-slate-200/40 py-1 rounded flex items-center justify-between transition-colors focus:outline-none"
                                                                >
                                                                    <div className="flex items-center gap-1">
                                                                        {isCollapsed ? <ChevronRight size={10} strokeWidth={3} /> : <ChevronDown size={10} strokeWidth={3} />}
                                                                        <span>{cat.label}</span>
                                                                    </div>
                                                                    <span className="text-[8px] bg-slate-200 text-slate-600 px-1 rounded">{catTemplates.length}</span>
                                                                </button>
                                                                
                                                                {!isCollapsed && (
                                                                    <div className="space-y-1.5 pl-0.5 animate-in fade-in-5 duration-150">
                                                                    {catTemplates.map(t => (
                                                                        <div
                                                                            key={t.template_id}
                                                                            draggable="true"
                                                                            onDragStart={(e) => {
                                                                                e.dataTransfer.setData("text/plain", t.template_id);
                                                                                e.dataTransfer.effectAllowed = "copy";
                                                                            }}
                                                                            onClick={() => {
                                                                                console.log('[RosterPage] Template clicked:', t.name);
                                                                                attachTemplateMutation.mutate([t.template_id]);
                                                                            }}
                                                                            className="group flex items-center justify-between px-2.5 py-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-[hsl(var(--brand-light))]/60 border border-slate-100 hover:border-[hsl(var(--brand))]/20 rounded-xl cursor-grab active:cursor-grabbing transition-all select-none"
                                                                        >
                                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                                <div className="text-slate-300 group-hover:text-[hsl(var(--brand))]/40 shrink-0">
                                                                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                                                                                        <circle cx="2" cy="2" r="1"/>
                                                                                        <circle cx="2" cy="5" r="1"/>
                                                                                        <circle cx="2" cy="8" r="1"/>
                                                                                        <circle cx="5" cy="2" r="1"/>
                                                                                        <circle cx="5" cy="5" r="1"/>
                                                                                        <circle cx="5" cy="8" r="1"/>
                                                                                    </svg>
                                                                                </div>
                                                                                <span className="truncate pr-1">{t.name}</span>
                                                                            </div>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-5 w-5 rounded-md text-slate-400 hover:text-[hsl(var(--brand))] hover:bg-white shrink-0"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    attachTemplateMutation.mutate([t.template_id]);
                                                                                }}
                                                                            >
                                                                                <Plus size={12} strokeWidth={3} />
                                                                            </Button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                            <div className="mt-2 text-[9px] text-slate-400 leading-tight shrink-0 bg-slate-50 p-2 rounded-lg border border-slate-100/50">
                                                💡 Drag a template and drop on the left, or click it to attach.
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-100 shrink-0">
                                    <p className="text-[10px] text-slate-400 leading-tight">
                                        <Info size={10} className="inline mr-1" />
                                        This is a shift-specific snapshot. Changes here will not affect the original template, and updating the template later will not affect this shift.
                                    </p>
                                </div>
                            </TabsContent>

                        </Tabs>
                    </DialogContent>
                </Dialog>

                <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
                    <DialogContent className="sm:max-w-[425px] bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 z-100">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <ClipboardList className="text-[hsl(var(--brand))]" size={20} />
                                Add Custom Task
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-400">
                                Create a custom ad-hoc task specifically for this roster shift snapshot.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 my-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Task Name</label>
                                <Input
                                    value={adHocTaskText}
                                    onChange={(e) => setAdHocTaskText(e.target.value)}
                                    placeholder="e.g. Clean the espresso machine"
                                    className="h-10 rounded-xl border-slate-100 focus:border-[hsl(var(--brand))] focus:ring-1 focus:ring-[hsl(var(--brand))] text-sm font-semibold"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Instructions (Optional)</label>
                                <textarea
                                    value={adHocTaskInstructions}
                                    onChange={(e) => setAdHocTaskInstructions(e.target.value)}
                                    placeholder="Describe step-by-step instructions..."
                                    className="w-full min-h-[80px] rounded-xl border border-slate-200 focus:border-[hsl(var(--brand))] focus:ring-1 focus:ring-[hsl(var(--brand))] p-3 text-sm font-semibold outline-none resize-none"
                                />
                            </div>

                            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                                <div>
                                    <p className="text-xs font-bold text-slate-700">Is Required?</p>
                                    <p className="text-[10px] text-slate-400">Employee must complete this task before clocking out.</p>
                                </div>
                                <Switch
                                    checked={adHocTaskRequired}
                                    onCheckedChange={setAdHocTaskRequired}
                                    className="data-[state=checked]:bg-[hsl(var(--brand))]"
                                />
                            </div>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0 mt-6">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setIsAddTaskOpen(false)}
                                className="h-10 rounded-xl text-xs font-bold uppercase text-slate-400 hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={() => {
                                    if (!adHocTaskText.trim()) {
                                        toast.error("Please enter a task name");
                                        return;
                                    }
                                    addTaskMutation.mutate({
                                        task_text: adHocTaskText.trim(),
                                        instructions: adHocTaskInstructions.trim() || null,
                                        is_required: adHocTaskRequired
                                    });
                                }}
                                disabled={addTaskMutation.isPending}
                                className="h-10 rounded-xl text-xs font-black uppercase tracking-wider bg-[hsl(var(--brand))] hover:bg-[hsl(var(--brand-hover))] text-white shadow-lg transition-colors px-6"
                            >
                                {addTaskMutation.isPending ? "Adding..." : "Add Task"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={isShiftTypeModalOpen} onOpenChange={setIsShiftTypeModalOpen}>
                    <DialogContent className="sm:max-w-[425px] bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 z-100">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Clock className="text-[hsl(var(--brand))]" size={20} />
                                Select Shift Type
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-400">
                                Choose or type a custom shift type name for this roster shift.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 my-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Search or Type Custom Type</label>
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="e.g. Midday, Stock Count, Saturday Night..."
                                    value={shiftTypeSearch}
                                    onChange={e => setShiftTypeSearch(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[hsl(var(--brand))] focus:ring-2 focus:ring-[hsl(var(--brand))]/20 text-sm font-semibold"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && shiftTypeSearch.trim()) {
                                            const customVal = shiftTypeSearch.trim().toLowerCase();
                                            setShiftType(customVal);
                                            setIsShiftTypeOverridden(true);
                                            setIsShiftTypeModalOpen(false);
                                            setShiftTypeSearch("");
                                        }
                                    }}
                                />
                                <p className="text-[9px] text-slate-400 leading-normal">Press Enter or click Add to create &apos;{shiftTypeSearch}&apos; as a custom shift type.</p>
                            </div>

                            <div className="max-h-60 overflow-y-auto space-y-2 p-1 custom-scrollbar border border-slate-100 rounded-xl bg-slate-50/50">
                                {/* Auto-detect Suggestion Option */}
                                {(() => {
                                    const autoType = getShiftTypeFromTime(shiftStart);
                                    const isActive = !isShiftTypeOverridden && shiftType === autoType;
                                    return (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShiftType(autoType);
                                                setIsShiftTypeOverridden(false);
                                                setIsShiftTypeModalOpen(false);
                                                setShiftTypeSearch("");
                                            }}
                                            className={cn(
                                                "w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-between border",
                                                isActive
                                                    ? "bg-[hsl(var(--brand))] text-white border-transparent shadow-md"
                                                    : "bg-white hover:bg-slate-50 border-slate-100 text-[hsl(var(--brand))]"
                                            )}
                                        >
                                            <span className="flex items-center gap-1.5">
                                                <span>✨ Auto-Detect Shift Type</span>
                                            </span>
                                            <Badge variant="outline" className={cn("text-[9px] font-black uppercase px-2 py-0.5", isActive ? "text-white border-white/30 bg-white/10" : "text-[hsl(var(--brand))] border-[hsl(var(--brand))]/20")}>
                                                {autoType}
                                            </Badge>
                                        </button>
                                    );
                                })()}

                                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider pt-2 pb-1 px-1 border-t border-slate-100/50">
                                    Configured Shift Types
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    {dynamicRosterShiftTypes
                                        .filter(t => t.toLowerCase().includes(shiftTypeSearch.toLowerCase()))
                                        .map(type => {
                                            const isActive = isShiftTypeOverridden && shiftType === type;
                                            return (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => {
                                                        setShiftType(type);
                                                        setIsShiftTypeOverridden(true);
                                                        setIsShiftTypeModalOpen(false);
                                                        setShiftTypeSearch("");
                                                    }}
                                                    className={cn(
                                                        "text-left px-3 py-2.5 text-xs font-bold rounded-xl transition-all border capitalize flex items-center justify-between",
                                                        isActive
                                                            ? "bg-[hsl(var(--brand))] text-white border-transparent shadow-md"
                                                            : "bg-white hover:bg-slate-50 border-slate-100 text-slate-700"
                                                    )}
                                                >
                                                    <span>{type}</span>
                                                </button>
                                            );
                                        })
                                    }
                                </div>

                                {shiftTypeSearch.trim() && !dynamicRosterShiftTypes.some(t => t.toLowerCase() === shiftTypeSearch.trim().toLowerCase()) && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const customVal = shiftTypeSearch.trim().toLowerCase();
                                            setShiftType(customVal);
                                            setIsShiftTypeOverridden(true);
                                            setIsShiftTypeModalOpen(false);
                                            setShiftTypeSearch("");
                                        }}
                                        className="w-full text-center py-2.5 text-xs rounded-xl bg-[hsl(var(--brand))]/10 border border-dashed border-[hsl(var(--brand))]/30 text-[hsl(var(--brand))] hover:bg-[hsl(var(--brand))]/20 transition-all font-bold mt-2"
                                    >
                                        + Create &quot;{shiftTypeSearch.trim()}&quot; Custom Shift Type
                                    </button>
                                )}
                            </div>
                        </div>

                        <DialogFooter className="mt-4">
                            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsShiftTypeModalOpen(false)}>
                                Cancel
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Confirm Deletion</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to delete this shift? This action cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
                            <Button
                                variant="default"
                                className="bg-[hsl(var(--danger))] text-white hover:bg-[hsl(var(--danger))]/90"
                                onClick={() => editingShiftId && deleteShiftMutation.mutate(editingShiftId)}
                                loading={deleteShiftMutation.isPending}
                            >
                                Delete Shift
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={expansionOpen} onOpenChange={setExpansionOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Expand Roster Duration?</DialogTitle>
                            <DialogDescription>
                                The date you selected falls outside the current roster range ({currentRoster ? `${formatDate(currentRoster.start_date)} to ${formatDate(currentRoster.end_date)}` : ""}).
                                Adding this shift will automatically switch and expand your current roster to a larger period (Monthly/Fortnightly).
                                <br /><br />
                                Do you want to switch the current roster?
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setExpansionOpen(false)}>Decline (Cancel Add)</Button>
                            <Button
                                variant="default"
                                className="bg-[hsl(var(--brand))] text-white hover:bg-[hsl(var(--brand-hover))]"
                                onClick={confirmExpansion}
                            >
                                Accept & Expand
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={deleteRosterConfirmOpen} onOpenChange={setDeleteRosterConfirmOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Delete Entire Roster?</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to delete this roster and **all its shifts**? This action cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeleteRosterConfirmOpen(false)}>Cancel</Button>
                            <Button
                                variant="default"
                                className="bg-red-600 text-white hover:bg-red-700"
                                onClick={() => currentRoster && deleteRosterMutation.mutate(currentRoster.roster_id)}
                                loading={deleteRosterMutation.isPending}
                            >
                                Delete Roster
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
                    <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                        <div className="bg-white p-6">
                            <DialogHeader className="mb-6">
                                <div className="flex items-center justify-between">
                                    <DialogTitle className="text-2xl font-bold text-[hsl(var(--foreground))]">Copy shifts</DialogTitle>
                                </div>
                            </DialogHeader>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between pl-1">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quick Copy</h3>
                                    <button
                                        onClick={() => setIsAdvancedCopy(!isAdvancedCopy)}
                                        className="text-[10px] font-black text-[hsl(var(--brand))] uppercase tracking-widest flex items-center gap-1 hover:underline"
                                    >
                                        {isAdvancedCopy ? <ChevronUp size={12} /> : <Settings2 size={12} />}
                                        {isAdvancedCopy ? "Simplified" : "Advanced"}
                                    </button>
                                </div>

                                {!isAdvancedCopy ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { id: 'next_week', label: `Next ${rosterPeriod === 'monthly' ? 'Month' : 'Week'}`, icon: ChevronRight },
                                            { id: 'prev_week', label: `Prev ${rosterPeriod === 'monthly' ? 'Month' : 'Week'}`, icon: ChevronLeft }
                                        ].map((opt) => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setCopyOption(opt.id as any)}
                                                className={cn(
                                                    "flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all group",
                                                    copyOption === opt.id
                                                        ? "bg-[hsl(var(--brand))]/5 border-[hsl(var(--brand))] text-[hsl(var(--brand))]"
                                                        : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                                    copyOption === opt.id ? "bg-[hsl(var(--brand))] text-white shadow-lg shadow-[hsl(var(--brand))]/20" : "bg-slate-50 text-slate-400"
                                                )}>
                                                    <opt.icon size={18} />
                                                </div>
                                                <span className="text-xs font-black uppercase tracking-wider">{opt.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 animate-in slide-in-from-top-2 duration-300">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Copy Shifts From</label>
                                            <div className="relative group">
                                                <select
                                                    value={sourceOffset}
                                                    onChange={(e) => setSourceOffset(parseInt(e.target.value))}
                                                    className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 outline-none transition-all focus:ring-4 focus:ring-[hsl(var(--brand))]/10 focus:border-[hsl(var(--brand))] appearance-none cursor-pointer pr-10"
                                                >
                                                    {periodOptions.map((opt) => (
                                                        <option key={opt.offset} value={opt.offset}>
                                                            {opt.label} {opt.offset === offset ? "(Current View)" : ""}
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                    <ChevronDown size={16} />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-center -my-2 relative z-10">
                                            <div className="bg-white p-2 rounded-full border border-slate-100 shadow-sm text-[hsl(var(--brand))]">
                                                <ArrowUpDown size={14} strokeWidth={3} />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Copy Shifts To</label>
                                            <div className="relative group">
                                                <select
                                                    value={targetOffset}
                                                    onChange={(e) => setTargetOffset(parseInt(e.target.value))}
                                                    className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 outline-none transition-all focus:ring-4 focus:ring-[hsl(var(--brand))]/10 focus:border-[hsl(var(--brand))] appearance-none cursor-pointer pr-10"
                                                >
                                                    {periodOptions.map((opt) => (
                                                        <option key={opt.offset} value={opt.offset}>
                                                            {opt.label} {opt.offset === offset ? "(Current View)" : ""}
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                    <ChevronDown size={16} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end mt-8">
                                <Button
                                    className="px-8 py-6 rounded-xl bg-[hsl(var(--brand))] text-white hover:bg-[hsl(var(--brand-hover))] font-bold text-lg shadow-lg shadow-[hsl(var(--brand))]/20"
                                    onClick={() => {
                                        let payload: any = null;

                                        if (isAdvancedCopy) {
                                            // Calculate source and target dates directly from offsets instead of searching periodOptions
                                            // This ensures we handle any offset value, not just those in the predefined periodOptions array
                                            const sourceDates = getRosterDates(sourceOffset, rosterPeriod);
                                            const targetDates = getRosterDates(targetOffset, rosterPeriod);

                                            if (sourceDates.length > 0 && targetDates.length > 0) {
                                                payload = {
                                                    source_from: formatDate(sourceDates[0]),
                                                    source_to: formatDate(sourceDates[sourceDates.length - 1]),
                                                    target_start: formatDate(targetDates[0])
                                                };
                                            }
                                        } else if (copyOption === 'next_week') {
                                            let daysToAdd = 7;
                                            if (rosterPeriod === 'fortnightly') daysToAdd = 14;

                                            if (rosterPeriod === 'monthly') {
                                                const dSource = new Date(rangeStart + 'T00:00:00Z');
                                                const dTarget = new Date(dSource);
                                                dTarget.setMonth(dTarget.getUTCMonth() + 1);

                                                payload = {
                                                    source_from: rangeStart,
                                                    source_to: rangeEnd,
                                                    target_start: formatDate(dTarget)
                                                };
                                            } else {
                                                payload = {
                                                    source_from: rangeStart,
                                                    source_to: rangeEnd,
                                                    target_start: formatDate(addDays(new Date(rangeStart + 'T00:00:00Z'), daysToAdd))
                                                };
                                            }
                                        } else if (copyOption === 'prev_week') {
                                            let daysToSub = 7;
                                            if (rosterPeriod === 'fortnightly') daysToSub = 14;

                                            if (rosterPeriod === 'monthly') {
                                                const dSource = new Date(rangeStart + 'T00:00:00Z');
                                                const dTarget = new Date(dSource);
                                                dTarget.setMonth(dTarget.getUTCMonth() - 1);

                                                // Source is prev month, target is current
                                                const dPrevEnd = new Date(dSource);
                                                dPrevEnd.setUTCDate(dPrevEnd.getUTCDate() - 1);

                                                payload = {
                                                    source_from: formatDate(dTarget),
                                                    source_to: formatDate(dPrevEnd),
                                                    target_start: rangeStart
                                                };
                                            } else {
                                                payload = {
                                                    source_from: formatDate(addDays(new Date(rangeStart + 'T00:00:00Z'), -daysToSub)),
                                                    source_to: formatDate(addDays(new Date(rangeEnd + 'T00:00:00Z'), -daysToSub)),
                                                    target_start: rangeStart
                                                };
                                            }
                                        }

                                        if (payload) {
                                            duplicateRosterMutation.mutate(payload);
                                        }
                                    }}
                                    loading={duplicateRosterMutation.isPending}
                                >
                                    Copy
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
                {/* Copy Result / Conflict Review Modal */}
                <Dialog open={resultModalOpen} onOpenChange={setResultModalOpen}>
                    <DialogContent className="max-w-md rounded-2xl border-none shadow-2xl p-0 overflow-hidden bg-white">
                        <DialogHeader className="p-6 pb-2 bg-[hsl(var(--brand))]/5">
                            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-[hsl(var(--brand))]">
                                <CheckCircle2 className="w-6 h-6" />
                                Copy Shifts Result
                            </DialogTitle>
                            <DialogDescription className="text-sm font-medium">
                                Review the outcome of your duplication
                            </DialogDescription>
                        </DialogHeader>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                                    <p className="text-2xl font-bold text-emerald-600">{copyResult?.copiedCount}</p>
                                    <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-500">Copied Successfully</p>
                                </div>
                                <div className={cn(
                                    "p-4 rounded-xl text-center border",
                                    (copyResult?.overlapCount ?? 0) > 0
                                        ? "bg-amber-50 border-amber-100 text-amber-600"
                                        : "bg-gray-50 border-gray-100 text-gray-400"
                                )}>
                                    <p className="text-2xl font-bold">{copyResult?.overlapCount}</p>
                                    <p className="text-[10px] uppercase tracking-wider font-bold">Issues / Overlaps</p>
                                </div>
                            </div>

                            {(copyResult?.overlapCount ?? 0) > 0 && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest pl-1">Conflict Details</label>
                                    <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50/50 p-2 space-y-2">
                                        {copyResult?.overlapDetails.map((detail, i) => (
                                            <div key={i} className="flex gap-3 text-xs leading-relaxed text-gray-600 p-2 rounded-lg bg-white shadow-sm border border-gray-100/50">
                                                <div className="mt-0.5 rounded-full bg-amber-100 p-1 shrink-0">
                                                    <RefreshCcw className="w-3 h-3 text-amber-600" />
                                                </div>
                                                {detail}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="p-6 pt-0 bg-gray-50/50 flex flex-row gap-3">
                            <Button
                                variant="outline"
                                className="flex-1 rounded-xl h-12 font-bold border-gray-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-100 transition-all group"
                                onClick={() => setUndoConfirmOpen(true)}
                            >
                                <RefreshCcw className="w-4 h-4 mr-2 group-hover:rotate-180 transition-transform duration-500" />
                                Undo Last Copy
                            </Button>
                            <Button
                                className="flex-1 rounded-xl h-12 font-bold bg-[hsl(var(--brand))] hover:bg-[hsl(var(--brand))]/90 shadow-lg shadow-[hsl(var(--brand))]/20"
                                onClick={() => setResultModalOpen(false)}
                            >
                                Done
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Undo Confirmation Modal */}
                <Dialog open={undoConfirmOpen} onOpenChange={setUndoConfirmOpen}>
                    <DialogContent className="max-w-sm rounded-2xl border-none shadow-2xl p-6 bg-white animate-in zoom-in-95 duration-200">
                        <div className="space-y-4">
                            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto">
                                <Clock className="w-6 h-6 text-amber-600" />
                            </div>

                            <DialogHeader className="text-center space-y-2">
                                <DialogTitle className="text-lg font-bold text-gray-900">Undo Copy?</DialogTitle>
                                <DialogDescription className="text-sm text-gray-500 leading-relaxed px-2">
                                    Are you sure you want to undo the last copy? This will remove
                                    <span className="font-bold text-gray-900 mx-1">{lastNewShiftIds.length}</span>
                                    newly created shifts.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <Button
                                    variant="outline"
                                    className="rounded-xl h-11 font-bold border-gray-200"
                                    onClick={() => setUndoConfirmOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="danger"
                                    className="rounded-xl h-11 font-bold shadow-lg shadow-red-100"
                                    onClick={() => undoLastCopyMutation.mutate()}
                                    disabled={undoLastCopyMutation.isPending}
                                >
                                    {undoLastCopyMutation.isPending ? "Undoing..." : "Yes, Undo IT"}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Overlapping Shift Conflict Warning Modal */}
                <Dialog open={conflictOpen} onOpenChange={setConflictOpen}>
                    <DialogContent className="max-w-md rounded-2xl border-none shadow-2xl p-6 bg-white animate-in zoom-in-95 duration-200">
                        <div className="space-y-4">
                            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto animate-bounce">
                                <AlertTriangle className="w-6 h-6 text-amber-600" />
                            </div>

                            <DialogHeader className="text-center space-y-2">
                                <DialogTitle className="text-lg font-bold text-gray-900">Overlapping Shift Conflict</DialogTitle>
                                <DialogDescription className="text-sm text-gray-500 leading-relaxed px-2">
                                    <span className="font-semibold text-gray-800">{conflictEmployeeName}</span> already has an overlapping shift on this day.
                                </DialogDescription>
                            </DialogHeader>

                            {conflictData && (
                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2 text-sm text-left">
                                    <div className="flex justify-between text-slate-500">
                                        <span>Date:</span>
                                        <span className="font-medium text-slate-800">
                                            {(() => {
                                                const d = parseConflictDate(conflictData.shift_date);
                                                return d ? format(d, "EEEE, d MMMM yyyy") : conflictData.shift_date;
                                            })()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-slate-500">
                                        <span>Shift Time:</span>
                                        <span className="font-medium text-slate-800">
                                            {formatShiftTime(conflictData.start_time)} - {formatShiftTime(conflictData.end_time)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-slate-500">
                                        <span>Type:</span>
                                        <span className="capitalize font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 text-xs">
                                            {conflictData.shift_type || "Standard"}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-3 text-center font-medium">
                                Scheduling this shift will create overlapping roster hours for this employee.
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <Button
                                    variant="outline"
                                    className="rounded-xl h-11 font-bold border-gray-200"
                                    onClick={() => setConflictOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="default"
                                    className="rounded-xl h-11 font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-100"
                                    onClick={handleForceSchedule}
                                >
                                    Continue Anyway
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>

    );
}
