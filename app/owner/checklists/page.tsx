"use client";

import { DashboardLayout } from "@/components/layout";
import { Input } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { ChecklistTemplate, ChecklistTemplateItem, ShiftTypeTemplateDefault } from "@/types/database";
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertCircle,
    BarChart3,
    CheckCircle2,
    ChevronRight,
    ClipboardList,
    Clock,
    Edit3,
    GripVertical,
    LayoutGrid,
    MoreHorizontal,
    Plus,
    Search,
    Settings2,
    Trash2
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const CATEGORIES = [
    { id: 'morning', label: 'Morning' },
    { id: 'afternoon', label: 'Afternoon' },
    { id: 'closing', label: 'Closing' },
    { id: 'delivery', label: 'Delivery' },
    { id: 'ordering', label: 'Ordering' },
    { id: 'manager', label: 'Manager' },
    { id: 'daily', label: 'Daily' },
];

const SHIFT_TYPES = ['morning', 'afternoon', 'evening', 'closing', 'delivery', 'ordering', 'manager', 'daily'];

export default function ChecklistsPage() {
    const queryClient = useQueryClient();
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newTemplate, setNewTemplate] = useState({ name: '', category: 'morning', description: '' });
    const [customShiftTypes, setCustomShiftTypes] = useState<string[]>([]);
    const [newShiftTypeName, setNewShiftTypeName] = useState("");

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleteTaskDialogOpen, setIsDeleteTaskDialogOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<{ id: string; itemId: string } | null>(null);

    const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false);
    const [newTaskText, setNewTaskText] = useState("");
    const [newTaskInstructions, setNewTaskInstructions] = useState("");
    const [newTaskIsRequired, setNewTaskIsRequired] = useState(false);

    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editTemplateName, setEditTemplateName] = useState("");
    const [editTemplateCategory, setEditTemplateCategory] = useState("morning");
    const [editTemplateDescription, setEditTemplateDescription] = useState("");

    const { data: mappings = [], isLoading: isLoadingMappings } = useQuery({
        queryKey: ["shift-type-templates"],
        queryFn: () => apiGet<ShiftTypeTemplateDefault[]>("/shift-type-templates"),
    });

    const dynamicShiftTypes = useMemo(() => {
        const baseTypes = ['morning', 'afternoon', 'evening', 'closing', 'delivery', 'ordering', 'manager', 'daily'];
        const mappedTypes = mappings.map(m => m.shift_type.toLowerCase());
        return Array.from(new Set([...baseTypes, ...mappedTypes, ...customShiftTypes]));
    }, [mappings, customShiftTypes]);

    // Queries
    const { data: templates = [], isLoading: isLoadingTemplates } = useQuery({
        queryKey: ["checklist-templates"],
        queryFn: () => apiGet<ChecklistTemplate[]>("/checklist-templates"),
    });

    const { data: selectedTemplate, isLoading: isLoadingDetails } = useQuery({
        queryKey: ["checklist-template", selectedTemplateId],
        queryFn: () => apiGet<ChecklistTemplate & { items: ChecklistTemplateItem[] }>(`/checklist-templates/${selectedTemplateId}`),
        enabled: !!selectedTemplateId,
    });

    // Mutations
    const createTemplateMutation = useMutation({
        mutationFn: (data: any) => apiPost("/checklist-templates", data),
        onSuccess: (data: any) => {
            toast.success("Template created successfully");
            queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
            setIsCreateDialogOpen(false);
            setNewTemplate({ name: '', category: 'morning', description: '' });
            setSelectedTemplateId(data.template_id);
        },
        onError: (err: any) => toast.error(err.message),
    });

    const deleteTemplateMutation = useMutation({
        mutationFn: (id: string) => apiDelete(`/checklist-templates/${id}`),
        onSuccess: () => {
            toast.success("Template deleted");
            queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
            if (selectedTemplateId === deleteTemplateMutation.variables) {
                setSelectedTemplateId(null);
            }
        },
        onError: (err: any) => toast.error(err.message),
    });

    const updateTemplateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => apiPut(`/checklist-templates/${id}`, data),
        onSuccess: () => {
            toast.success("Template updated successfully");
            queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
            queryClient.invalidateQueries({ queryKey: ["checklist-template", selectedTemplateId] });
            setIsEditDialogOpen(false);
        },
        onError: (err: any) => toast.error(err.message),
    });

    const updateItemMutation = useMutation({
        mutationFn: ({ id, itemId, data }: { id: string, itemId: string, data: any }) =>
            apiPut(`/checklist-templates/${id}/items/${itemId}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["checklist-template", selectedTemplateId] });
        },
        onError: (err: any) => toast.error(err.message),
    });

    const reorderItemsMutation = useMutation({
        mutationFn: ({ id, items }: { id: string, items: any[] }) =>
            apiPut(`/checklist-templates/${id}/items`, { items }),
        onError: (err: any) => toast.error(err.message),
    });

    const reorderTemplatesMutation = useMutation({
        mutationFn: (reorders: any[]) => apiPut("/checklist-templates/reorder", { reorders }),
        onSuccess: () => {
            // queryClient.invalidateQueries({ queryKey: ["checklist-templates"] }); // Optional: Avoid invalidation to prevent jitter since we optimistically updated
        },
        onError: (err: any) => toast.error(err.message),
    });

    const addItemMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) =>
            apiPost(`/checklist-templates/${id}/items`, data),
        onSuccess: () => {
            toast.success("Task added");
            queryClient.invalidateQueries({ queryKey: ["checklist-template", selectedTemplateId] });
            queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
        },
        onError: (err: any) => toast.error(err.message),
    });

    const removeItemMutation = useMutation({
        mutationFn: ({ id, itemId }: { id: string, itemId: string }) =>
            apiDelete(`/checklist-templates/${id}/items/${itemId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["checklist-template", selectedTemplateId] });
            queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
        },
        onError: (err: any) => toast.error(err.message),
    });

    const updateMappingMutation = useMutation({
        mutationFn: ({ shiftType, templateId, action }: { shiftType: string, templateId: string, action: 'add' | 'remove' }) => {
            if (action === 'add') {
                return apiPost("/shift-type-templates", { shift_type: shiftType, template_id: templateId });
            } else {
                return apiDelete(`/shift-type-templates?shift_type=${shiftType}&template_id=${templateId}`);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["shift-type-templates"] });
        },
        onError: (err: any) => toast.error(err.message),
    });

    const filteredTemplates = useMemo(() => {
        return templates.filter(t =>
            t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.category.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [templates, searchQuery]);

    const templatesByCategory = useMemo(() => {
        const grouped: Record<string, ChecklistTemplate[]> = {};
        filteredTemplates.forEach(t => {
            if (!grouped[t.category]) grouped[t.category] = [];
            grouped[t.category].push(t);
        });
        return grouped;
    }, [filteredTemplates]);

    const handleCreateTemplate = () => {
        if (!newTemplate.name) return toast.error("Template name is required");
        createTemplateMutation.mutate(newTemplate);
    };

    const handleAddTask = () => {
        if (!selectedTemplateId) return;
        setNewTaskText("");
        setNewTaskInstructions("");
        setNewTaskIsRequired(false);
        setIsAddTaskDialogOpen(true);
    };

    const handleAddTaskSubmit = () => {
        if (!selectedTemplateId) return;
        if (!newTaskText.trim()) {
            toast.error("Task text is required");
            return;
        }
        addItemMutation.mutate({
            id: selectedTemplateId,
            data: {
                task_text: newTaskText.trim(),
                instructions: newTaskInstructions.trim() || null,
                is_required: newTaskIsRequired,
                is_active: true
            }
        }, {
            onSuccess: () => {
                setIsAddTaskDialogOpen(false);
            }
        });
    };

    const handleDeleteTemplateConfirm = () => {
        if (!selectedTemplate) return;
        deleteTemplateMutation.mutate(selectedTemplate.template_id, {
            onSuccess: () => {
                setIsDeleteDialogOpen(false);
            }
        });
    };

    const handleDeleteTaskConfirm = () => {
        if (!taskToDelete) return;
        removeItemMutation.mutate(taskToDelete, {
            onSuccess: () => {
                setIsDeleteTaskDialogOpen(false);
                setTaskToDelete(null);
            }
        });
    };

    const handleEditTemplateClick = () => {
        if (!selectedTemplate) return;
        setEditTemplateName(selectedTemplate.name);
        setEditTemplateCategory(selectedTemplate.category);
        setEditTemplateDescription(selectedTemplate.description || "");
        setIsEditDialogOpen(true);
    };

    const handleUpdateTemplate = () => {
        if (!selectedTemplateId || !selectedTemplate) return;
        if (!editTemplateName.trim()) {
            toast.error("Template name is required");
            return;
        }
        updateTemplateMutation.mutate({
            id: selectedTemplateId,
            data: {
                name: editTemplateName.trim(),
                category: editTemplateCategory,
                description: editTemplateDescription.trim() || null,
                is_active: selectedTemplate.is_active
            }
        });
    };

    const handleTaskDragEnd = (result: DropResult) => {
        const { source, destination } = result;

        if (!destination) return;
        if (source.index === destination.index) return;
        if (!selectedTemplate) return;

        // Optimistic update
        const items = Array.from(selectedTemplate.items || []);
        const [reorderedItem] = items.splice(source.index, 1);
        items.splice(destination.index, 0, reorderedItem);

        const updatedItems = items.map((item, index) => ({
            ...item,
            sort_order: index
        }));

        queryClient.setQueryData(
            ["checklist-template", selectedTemplateId],
            { ...selectedTemplate, items: updatedItems }
        );

        // Save to backend
        reorderItemsMutation.mutate({
            id: selectedTemplate.template_id,
            items: updatedItems.map(i => ({
                item_id: i.item_id,
                sort_order: i.sort_order,
                task_text: i.task_text,
                instructions: i.instructions,
                is_required: i.is_required,
                is_active: i.is_active,
                template_id: i.template_id,
                business_id: i.business_id,
            }))
        });
    };

    // handle drag end for reordering templates within and across categories
    const handleDragEnd = (result: DropResult) => {
        const { source, destination } = result;

        // 1. Dropped outside a valid droppable area
        if (!destination) return;

        // 2. Dropped in the exact same spot
        if (source.droppableId === destination.droppableId && source.index === destination.index) {
            return;
        }

        const sourceCategory = source.droppableId;
        const destCategory = destination.droppableId;

        // 3. Get the current templates directly from the TanStack Query cache
        const currentTemplates = queryClient.getQueryData<ChecklistTemplate[]>(["checklist-templates"]) || [];

        // 4. Group current cached templates by category so we can modify the slices safely
        const grouped: Record<string, ChecklistTemplate[]> = {};
        currentTemplates.forEach(t => {
            if (!grouped[t.category]) grouped[t.category] = [];
            grouped[t.category].push(t);
        });

        const sourceItems = [...(grouped[sourceCategory] || [])];
        const destItems = sourceCategory === destCategory
            ? sourceItems
            : [...(grouped[destCategory] || [])];

        // 5. Pull out the dragged template
        const [movedItem] = sourceItems.splice(source.index, 1);

        // 6. Update its category string to match the destination category
        const updatedMovedItem = {
            ...movedItem,
            category: destCategory
        };

        // 7. Insert it into its new index position
        destItems.splice(destination.index, 0, updatedMovedItem);

        // 8. Reconstruct the final flattened array for the cache
        const untouchedTemplates = currentTemplates.filter(
            (t) => t.category !== sourceCategory && t.category !== destCategory
        );

        const finalTemplates = sourceCategory === destCategory
            ? [...untouchedTemplates, ...sourceItems]
            : [...untouchedTemplates, ...sourceItems, ...destItems];

        // 9. Optimistically update the TanStack Query cache so the UI updates instantly
        queryClient.setQueryData(["checklist-templates"], finalTemplates);

        // 10. Persist changes to your database
        if (sourceCategory !== destCategory) {
            // If it switched categories, fire your existing update mutation
            updateTemplateMutation.mutate({
                id: updatedMovedItem.template_id,
                data: {
                    name: updatedMovedItem.name,
                    category: destCategory,
                    description: updatedMovedItem.description,
                    is_active: updatedMovedItem.is_active
                }
            });
            // Also update the sort_order of items in the destination category
            reorderTemplatesMutation.mutate(
                destItems.map((t, idx) => ({ template_id: t.template_id, sort_order: idx }))
            );
        } else {
            // Reordering items within the same category
            reorderTemplatesMutation.mutate(
                destItems.map((t, idx) => ({ template_id: t.template_id, sort_order: idx }))
            );
        }
    };

    return (
        <DashboardLayout role="owner" pageTitle="Checklists" pageDescription="Manage shift task templates">
            <div className="flex h-[calc(100vh-180px)] gap-6 overflow-hidden">

                {/* Left Panel: Template List */}
                <div className="w-80 flex flex-col bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-[hsl(var(--border))] space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="font-bold text-lg flex items-center gap-2">
                                <ClipboardList size={20} className="text-[hsl(var(--brand))]" />
                                Templates
                            </h2>
                            <div className="flex items-center gap-1">
                                <Link href="/owner/checklists/audit">
                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-[hsl(var(--brand))]" title="Audit Logs">
                                        <BarChart3 size={18} />
                                    </Button>
                                </Link>
                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setIsCreateDialogOpen(true)}>
                                    <Plus size={18} />
                                </Button>
                            </div>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" size={14} />
                            <Input
                                placeholder="Search templates..."
                                className="pl-9 h-9 bg-[hsl(var(--muted))]/30 border-none rounded-xl text-xs"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-4 custom-scrollbar">
                        {isLoadingTemplates ? (
                            <div className="flex flex-col gap-2 p-4 animate-pulse">
                                {[1, 2, 3].map(i => <div key={i} className="h-12 bg-[hsl(var(--muted))] rounded-xl" />)}
                            </div>
                        ) : templates.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-center p-4">
                                <AlertCircle size={32} className="text-[hsl(var(--muted-foreground))] mb-2 opacity-20" />
                                <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium">No templates found.</p>
                                <Button variant="link" size="sm" onClick={() => setIsCreateDialogOpen(true)}>Create one</Button>
                            </div>
                        ) : (
                            /* 2. Wrap the entire scrollable/draggable area in DragDropContext */
                            <DragDropContext onDragEnd={handleDragEnd}>
                                {CATEGORIES.map(cat => {
                                    const catTemplates = templatesByCategory[cat.id];
                                    if (!catTemplates) return null;
                                    return (
                                        <div key={cat.id} className="space-y-1">
                                            <h3 className="px-3 text-[10px] font-black uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1 flex items-center justify-between">
                                                {cat.label}
                                                <span className="bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded text-[8px]">{catTemplates.length}</span>
                                            </h3>


                                            <Droppable droppableId={cat.id.toString()}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.droppableProps}
                                                        className={cn(
                                                            "space-y-1 min-h-[10px] transition-colors rounded-xl",
                                                            snapshot.isDraggingOver && "bg-[hsl(var(--muted))]/20"
                                                        )}
                                                    >
                                                        {catTemplates.map((t, index) => (

                                                            <Draggable
                                                                key={t.template_id}
                                                                draggableId={t.template_id.toString()}
                                                                index={index}
                                                            >
                                                                {(provided, snapshot) => (
                                                                    <div
                                                                        ref={provided.innerRef}
                                                                        {...provided.draggableProps}
                                                                        {...provided.dragHandleProps}
                                                                        style={{
                                                                            ...provided.draggableProps.style,
                                                                        }}
                                                                        onClick={() => setSelectedTemplateId(t.template_id)}
                                                                        className={cn(
                                                                            "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all group cursor-pointer select-none",
                                                                            selectedTemplateId === t.template_id
                                                                                ? "bg-[hsl(var(--brand))] text-white shadow-lg shadow-[hsl(var(--brand))]/20 scale-[1.02] z-10"
                                                                                : "hover:bg-[hsl(var(--muted))]/50 text-[hsl(var(--foreground))]",
                                                                            snapshot.isDragging && "shadow-xl bg-[hsl(var(--accent))] scale-[1.04]"
                                                                        )}
                                                                    >
                                                                        <div className="truncate pr-2">
                                                                            <p className="text-sm font-bold truncate leading-tight mb-0.5">{t.name}</p>
                                                                            <p className={cn("text-[10px] font-medium opacity-60", selectedTemplateId === t.template_id ? "text-white" : "")}>
                                                                                {(t as any).item_count} tasks
                                                                            </p>
                                                                        </div>
                                                                        <ChevronRight size={14} className={cn("shrink-0 opacity-0 group-hover:opacity-100 transition-opacity", selectedTemplateId === t.template_id ? "opacity-100" : "")} />
                                                                    </div>
                                                                )}
                                                            </Draggable>
                                                        ))}
                                                        {/* 5. Crucial placeholder element to prevent structural collapse during drag */}
                                                        {provided.placeholder}
                                                    </div>
                                                )}
                                            </Droppable>
                                        </div>
                                    );
                                })}
                            </DragDropContext>
                        )}
                    </div>
                </div>

                {/* Right Panel: Editor / Mappings */}
                <div className="flex-1 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl overflow-hidden shadow-sm flex flex-col">
                    <Tabs defaultValue="editor" className="flex flex-col h-full">
                        <div className="px-6 border-b border-[hsl(var(--border))] flex items-center justify-between h-16 shrink-0">
                            <TabsList className="bg-[hsl(var(--muted))]/50 rounded-xl p-1 h-10 border border-[hsl(var(--border))]">
                                <TabsTrigger value="editor" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">
                                    <LayoutGrid size={14} className="mr-2" />
                                    Template Editor
                                </TabsTrigger>
                                <TabsTrigger value="defaults" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">
                                    <Clock size={14} className="mr-2" />
                                    Shift Type Defaults
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="editor" className="flex-1 overflow-hidden flex flex-col m-0 p-0">
                            {!selectedTemplateId ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 animate-in fade-in duration-500">
                                    <div className="bg-[hsl(var(--brand-light))] p-6 rounded-3xl mb-6">
                                        <ClipboardList size={48} className="text-[hsl(var(--brand))]" />
                                    </div>
                                    <h3 className="text-2xl font-black mb-2">No Template Selected</h3>
                                    <p className="text-[hsl(var(--muted-foreground))] max-w-xs mx-auto mb-8">
                                        Select a template from the list or create a new one to start building your checklist.
                                    </p>
                                    <Button onClick={() => setIsCreateDialogOpen(true)} className="rounded-xl px-8 shadow-xl shadow-[hsl(var(--brand))]/20">
                                        <Plus size={18} className="mr-2" />
                                        Create First Template
                                    </Button>
                                </div>
                            ) : isLoadingDetails ? (
                                <div className="flex-1 flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="h-10 w-10 border-4 border-[hsl(var(--brand))] border-t-transparent rounded-full animate-spin" />
                                        <p className="text-sm font-bold text-[hsl(var(--muted-foreground))]">Loading template details...</p>
                                    </div>
                                </div>
                            ) : selectedTemplate ? (
                                <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
                                    {/* Header */}
                                    <div className="p-6 border-b border-[hsl(var(--border))] flex items-center justify-between shrink-0">
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h2 className="text-2xl font-black">{selectedTemplate.name}</h2>
                                                <Badge variant="secondary" className="bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] border-none font-black text-[10px] uppercase">
                                                    {selectedTemplate.category}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-[hsl(var(--muted-foreground))] font-medium">
                                                {selectedTemplate.description || "No description provided."}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-10 w-10 rounded-xl"
                                                title="Edit Template Metadata"
                                                onClick={handleEditTemplateClick}
                                            >
                                                <Edit3 size={18} />
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl">
                                                        <MoreHorizontal size={18} />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    <DropdownMenuItem
                                                        className="text-[hsl(var(--danger))] cursor-pointer"
                                                        onClick={() => setIsDeleteDialogOpen(true)}
                                                    >
                                                        <Trash2 size={14} className="mr-2" />
                                                        Delete Template
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>

                                    {/* Task List */}
                                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="font-black text-sm uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                                                Shift Tasks ({selectedTemplate.items?.length || 0})
                                            </h3>
                                            <Button size="sm" onClick={handleAddTask} className="h-8 rounded-lg text-xs font-bold px-3">
                                                <Plus size={14} className="mr-1" />
                                                Add Task
                                            </Button>
                                        </div>

                                        <DragDropContext onDragEnd={handleTaskDragEnd}>
                                            <Droppable droppableId="tasks-list">
                                                {(provided) => (
                                                    <div
                                                        {...provided.droppableProps}
                                                        ref={provided.innerRef}
                                                        className="space-y-3"
                                                    >
                                                        {selectedTemplate.items && selectedTemplate.items.length > 0 ? (
                                                            selectedTemplate.items.map((item, idx) => (
                                                                <Draggable key={item.item_id} draggableId={item.item_id} index={idx}>
                                                                    {(provided, snapshot) => (
                                                                        <div
                                                                            ref={provided.innerRef}
                                                                            {...provided.draggableProps}
                                                                            className={cn(
                                                                                "group flex items-center gap-4 p-4 bg-[hsl(var(--muted))]/20 border border-[hsl(var(--border))] rounded-2xl hover:border-[hsl(var(--brand))] hover:bg-[hsl(var(--brand-light))]/5 transition-all",
                                                                                snapshot.isDragging && "shadow-xl bg-white border-[hsl(var(--brand))] scale-[1.02] z-50"
                                                                            )}
                                                                        >
                                                                            <div
                                                                                {...provided.dragHandleProps}
                                                                                className="cursor-grab active:cursor-grabbing text-[hsl(var(--muted-foreground))] opacity-20 group-hover:opacity-100 transition-opacity"
                                                                            >
                                                                                <GripVertical size={18} />
                                                                            </div>

                                                                            <div className="flex-1">
                                                                                <input
                                                                                    className="w-full bg-transparent border-none font-bold text-sm focus:ring-0 p-0 placeholder:opacity-50"
                                                                                    defaultValue={item.task_text}
                                                                                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                                                                    onBlur={(e) => {
                                                                                        if (e.target.value !== item.task_text) {
                                                                                            updateItemMutation.mutate({
                                                                                                id: selectedTemplate.template_id,
                                                                                                itemId: item.item_id,
                                                                                                data: { task_text: e.target.value }
                                                                                            });
                                                                                        }
                                                                                    }}
                                                                                />
                                                                                <input
                                                                                    className="w-full bg-transparent border-none text-[11px] text-[hsl(var(--muted-foreground))] font-medium focus:ring-0 p-0 placeholder:opacity-30 mt-0.5"
                                                                                    placeholder="Add instructions (optional)..."
                                                                                    defaultValue={item.instructions || ""}
                                                                                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                                                                    onBlur={(e) => {
                                                                                        if (e.target.value !== (item.instructions || "")) {
                                                                                            updateItemMutation.mutate({
                                                                                                id: selectedTemplate.template_id,
                                                                                                itemId: item.item_id,
                                                                                                data: { instructions: e.target.value || null }
                                                                                            });
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            </div>

                                                                            <div className="flex items-center gap-6 shrink-0">
                                                                                <div className="flex flex-col items-center gap-1">
                                                                                    <span className="text-[9px] font-black uppercase text-[hsl(var(--muted-foreground))]">Required</span>
                                                                                    <Switch
                                                                                        checked={item.is_required}
                                                                                        onCheckedChange={(val) => {
                                                                                            updateItemMutation.mutate({
                                                                                                id: selectedTemplate.template_id,
                                                                                                itemId: item.item_id,
                                                                                                data: { is_required: val }
                                                                                            });
                                                                                        }}
                                                                                        className="scale-75 data-[state=checked]:bg-[hsl(var(--brand))]"
                                                                                    />
                                                                                </div>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-8 w-8 rounded-full text-[hsl(var(--danger))] opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                    onClick={() => {
                                                                                        setTaskToDelete({
                                                                                            id: selectedTemplate.template_id,
                                                                                            itemId: item.item_id
                                                                                        });
                                                                                        setIsDeleteTaskDialogOpen(true);
                                                                                    }}
                                                                                >
                                                                                    <Trash2 size={16} />
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </Draggable>
                                                            ))
                                                        ) : (
                                                            <div className="flex flex-col items-center justify-center py-12 bg-[hsl(var(--muted))]/10 border-2 border-dashed border-[hsl(var(--border))] rounded-3xl text-center">
                                                                <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                                                                    <Plus size={32} className="text-[hsl(var(--muted-foreground))] opacity-20" />
                                                                </div>
                                                                <p className="text-sm font-bold text-[hsl(var(--muted-foreground))] mb-4">Your checklist is empty.</p>
                                                                <Button onClick={handleAddTask} variant="outline" size="sm" className="rounded-xl">
                                                                    Add First Task
                                                                </Button>
                                                            </div>
                                                        )}
                                                        {provided.placeholder}
                                                    </div>
                                                )}
                                            </Droppable>
                                        </DragDropContext>
                                    </div>
                                </div>
                            ) : null}
                        </TabsContent>

                        <TabsContent value="defaults" className="flex-1 overflow-y-auto p-6 m-0 custom-scrollbar">
                            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="bg-[hsl(var(--brand-light))]/30 p-8 rounded-4xl border border-[hsl(var(--brand-light))] shadow-sm flex items-center gap-6">
                                    <div className="bg-[hsl(var(--brand))] p-4 rounded-2xl shadow-xl shadow-[hsl(var(--brand))]/20 shrink-0">
                                        <Settings2 size={32} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black mb-1">Shift Type Defaults</h3>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))] font-medium leading-relaxed">
                                            Assign templates to specific shift types. New shifts will automatically copy all tasks from their assigned default templates.
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-3xl border border-[hsl(var(--border))] shadow-sm space-y-4">
                                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Configure Custom Shift Type</h4>
                                    <div className="flex gap-3">
                                        <Input
                                            placeholder="Enter new shift type name (e.g. Night, Holiday, Stock Count)..."
                                            value={newShiftTypeName}
                                            onChange={e => setNewShiftTypeName(e.target.value)}
                                            className="rounded-xl"
                                        />
                                        <Button
                                            type="button"
                                            onClick={() => {
                                                const cleaned = newShiftTypeName.trim().toLowerCase();
                                                if (!cleaned) {
                                                    toast.error("Please enter a valid shift type name.");
                                                    return;
                                                }
                                                if (dynamicShiftTypes.includes(cleaned)) {
                                                    toast.error("This shift type already exists!");
                                                    return;
                                                }
                                                setCustomShiftTypes(prev => [...prev, cleaned]);
                                                setNewShiftTypeName("");
                                                toast.success(`"${cleaned}" added! Assign a template to save it permanently.`);
                                            }}
                                            className="rounded-xl font-black text-xs px-6"
                                        >
                                            Add Type
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {dynamicShiftTypes.map(shiftType => {
                                        const typeMappings = mappings.filter(m => m.shift_type === shiftType);
                                        return (
                                            <div key={shiftType} className="p-5 bg-white border border-[hsl(var(--border))] rounded-3xl shadow-sm hover:shadow-md transition-all">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h4 className="font-black capitalize flex items-center gap-2">
                                                        <Clock size={16} className="text-[hsl(var(--brand))]" />
                                                        {shiftType} Shift
                                                    </h4>
                                                    <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-none font-bold">
                                                        {typeMappings.length} assigned
                                                    </Badge>
                                                </div>

                                                <div className="space-y-2">
                                                    {templates.map(t => {
                                                        const isAssigned = typeMappings.some(m => m.template_id === t.template_id);
                                                        return (
                                                            <button
                                                                key={t.template_id}
                                                                onClick={() => {
                                                                    updateMappingMutation.mutate({
                                                                        shiftType,
                                                                        templateId: t.template_id,
                                                                        action: isAssigned ? 'remove' : 'add'
                                                                    });
                                                                }}
                                                                className={cn(
                                                                    "w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-bold transition-all",
                                                                    isAssigned
                                                                        ? "bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] border border-[hsl(var(--brand))]/20"
                                                                        : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                                                                )}
                                                            >
                                                                <span className="truncate">{t.name}</span>
                                                                {isAssigned ? <CheckCircle2 size={14} className="shrink-0" /> : <div className="w-3.5 h-3.5 border-2 border-slate-200 rounded-full shrink-0" />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* Create Template Dialog */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New Checklist Template</DialogTitle>
                        <DialogDescription>
                            Create a reusable task list for your shifts.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <Input
                            label="Template Name"
                            placeholder="e.g. Morning Opening Checklist"
                            value={newTemplate.name}
                            onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                        />
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest text-[10px]">Category</label>
                            <div className="grid grid-cols-2 gap-2">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setNewTemplate({ ...newTemplate, category: cat.id })}
                                        className={cn(
                                            "flex items-center justify-center h-10 rounded-xl text-xs font-bold transition-all border",
                                            newTemplate.category === cat.id
                                                ? "bg-[hsl(var(--brand-light))] border-[hsl(var(--brand))] text-[hsl(var(--brand))]"
                                                : "bg-[hsl(var(--muted))]/20 border-transparent text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--border))]"
                                        )}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest text-[10px]">Description (Optional)</label>
                            <textarea
                                className="w-full h-24 rounded-xl border border-[hsl(var(--border))] bg-transparent p-3 text-sm focus:ring-2 focus:ring-[hsl(var(--brand))]/20 focus:border-[hsl(var(--brand))] outline-none resize-none"
                                placeholder="Explain what this checklist covers..."
                                value={newTemplate.description}
                                onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="rounded-xl">Cancel</Button>
                        <Button onClick={handleCreateTemplate} loading={createTemplateMutation.isPending} className="rounded-xl px-6">
                            Create Template
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Template Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-[hsl(var(--danger))]">
                            <AlertCircle size={20} />
                            Delete Template
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete the checklist template "{selectedTemplate?.name}"? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="rounded-xl">Cancel</Button>
                        <Button
                            variant="danger"
                            onClick={handleDeleteTemplateConfirm}
                            loading={deleteTemplateMutation.isPending}
                            className="rounded-xl px-6 bg-[hsl(var(--danger))] hover:bg-[hsl(var(--danger))]/90 text-white border-transparent"
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Task Confirmation Dialog */}
            <Dialog open={isDeleteTaskDialogOpen} onOpenChange={setIsDeleteTaskDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-[hsl(var(--danger))]">
                            <Trash2 size={20} />
                            Delete Task
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this task from the template?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsDeleteTaskDialogOpen(false)} className="rounded-xl">Cancel</Button>
                        <Button
                            variant="danger"
                            onClick={handleDeleteTaskConfirm}
                            loading={removeItemMutation.isPending}
                            className="rounded-xl px-6 bg-[hsl(var(--danger))] hover:bg-[hsl(var(--danger))]/90 text-white border-transparent"
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Task Dialog */}
            <Dialog open={isAddTaskDialogOpen} onOpenChange={setIsAddTaskDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Task to Template</DialogTitle>
                        <DialogDescription>
                            Define the task details and options below.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <Input
                            label="Task Title"
                            placeholder="e.g. Turn off oven and grills"
                            value={newTaskText}
                            onChange={(e) => setNewTaskText(e.target.value)}
                        />
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest text-[10px]">Instructions (Optional)</label>
                            <textarea
                                className="w-full h-24 rounded-xl border border-[hsl(var(--border))] bg-transparent p-3 text-sm focus:ring-2 focus:ring-[hsl(var(--brand))]/20 focus:border-[hsl(var(--brand))] outline-none resize-none"
                                placeholder="e.g. Ensure gas main valve is turned off and surfaces are cool."
                                value={newTaskInstructions}
                                onChange={(e) => setNewTaskInstructions(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-[hsl(var(--muted))]/20 rounded-2xl border border-[hsl(var(--border))]">
                            <div className="space-y-0.5">
                                <p className="text-sm font-bold">Required Task</p>
                                <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium">Employees must complete this task before clocking out.</p>
                            </div>
                            <Switch
                                checked={newTaskIsRequired}
                                onCheckedChange={setNewTaskIsRequired}
                                className="data-[state=checked]:bg-[hsl(var(--brand))]"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddTaskDialogOpen(false)} className="rounded-xl">Cancel</Button>
                        <Button
                            onClick={handleAddTaskSubmit}
                            loading={addItemMutation.isPending}
                            className="rounded-xl px-6"
                            disabled={!newTaskText.trim()}
                        >
                            Add Task
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Template Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Template Details</DialogTitle>
                        <DialogDescription>
                            Update the name, category, and description for this template.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <Input
                            label="Template Name"
                            placeholder="e.g. Morning Opening Checklist"
                            value={editTemplateName}
                            onChange={(e) => setEditTemplateName(e.target.value)}
                        />
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest text-[10px]">Category</label>
                            <div className="grid grid-cols-2 gap-2">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setEditTemplateCategory(cat.id)}
                                        className={cn(
                                            "flex items-center justify-center h-10 rounded-xl text-xs font-bold transition-all border",
                                            editTemplateCategory === cat.id
                                                ? "bg-[hsl(var(--brand-light))] border-[hsl(var(--brand))] text-[hsl(var(--brand))]"
                                                : "bg-[hsl(var(--muted))]/20 border-transparent text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--border))]"
                                        )}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest text-[10px]">Description (Optional)</label>
                            <textarea
                                className="w-full h-24 rounded-xl border border-[hsl(var(--border))] bg-transparent p-3 text-sm focus:ring-2 focus:ring-[hsl(var(--brand))]/20 focus:border-[hsl(var(--brand))] outline-none resize-none"
                                placeholder="Explain what this checklist covers..."
                                value={editTemplateDescription}
                                onChange={(e) => setEditTemplateDescription(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-xl">Cancel</Button>
                        <Button
                            onClick={handleUpdateTemplate}
                            loading={updateTemplateMutation.isPending}
                            className="rounded-xl px-6"
                            disabled={!editTemplateName.trim()}
                        >
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}