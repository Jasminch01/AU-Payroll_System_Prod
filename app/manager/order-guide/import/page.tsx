"use client";

import React, { useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiUpload, apiPost } from "@/lib/api-client";
import { toast } from "sonner";
import {
    Upload,
    Globe,
    FileSpreadsheet,
    AlertCircle,
    CheckCircle,
    Loader2,
    Info,
    ArrowRight,
    HelpCircle,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";

interface ImportResult {
    success: boolean;
    results?: Record<string, { successCount: number; errors: any[] }>;
    summary?: { categoriesCount: number; itemsCount: number; errorsCount: number };
}

export default function SpreadsheetImport() {
    const { user } = useAuth();
    const basePath = user?.role === "owner" ? "/owner/order-guide" : "/manager/order-guide";
    const [file, setFile] = useState<File | null>(null);
    const [sheetUrl, setSheetUrl] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setImportResult(null);
        }
    };

    const handleUploadFile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            toast.error("Please select a file first");
            return;
        }

        setIsUploading(true);
        setImportResult(null);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await apiUpload<any>("/order-guide-items/import", formData);
            setImportResult({
                success: true,
                results: res.results,
                summary: res.summary,
            });
            toast.success("Spreadsheet uploaded successfully!");
        } catch (err: any) {
            console.error(err);
            setImportResult({
                success: false,
            });
            toast.error(err.message || "Failed to parse spreadsheet file");
        } finally {
            setIsUploading(false);
        }
    };

    const handleUploadUrl = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sheetUrl.trim()) {
            toast.error("Please enter a Google Sheets URL");
            return;
        }

        setIsUploading(true);
        setImportResult(null);

        try {
            const res = await apiPost<any>("/order-guide-items/import", {
                google_sheets_url: sheetUrl,
            });
            setImportResult({
                success: true,
                results: res.results,
                summary: res.summary,
            });
            toast.success("Google Sheets imported successfully!");
        } catch (err: any) {
            console.error(err);
            setImportResult({
                success: false,
            });
            toast.error(err.message || "Failed to fetch and parse Google Sheets");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <DashboardLayout
            role={user?.role === "owner" ? "owner" : "manager"}
            pageTitle="Bulk Import"
            pageDescription="Upload an Excel workbook or link a public Google Sheet. Each tab becomes a category, and rows become products."
        >
            <div className="space-y-6 max-w-4xl">
                {/* Requirements Help card */}
                <Card className="border border-indigo-100 bg-indigo-50/20 dark:border-indigo-900/30">
                    <CardHeader className="pb-3 flex flex-row items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-500 text-white shrink-0">
                            <Info className="h-5 w-5" />
                        </div>
                        <div className="space-y-0.5">
                            <CardTitle className="text-base font-bold">Spreadsheet Columns Guideline</CardTitle>
                            <CardDescription>
                                For successful parsing, verify your spreadsheet contains these exact columns:
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="text-xs font-semibold text-muted-foreground space-y-2 pl-14">
                        <ul className="list-disc space-y-1.5 leading-relaxed">
                            <li><strong className="text-foreground">Product Name</strong> (required) — Unique name of the item.</li>
                            <li><strong className="text-foreground">Min Stock Qty</strong> (required) — Inventory trigger threshold.</li>
                            <li><strong className="text-foreground">Max Stock Qty</strong> (required) — Target shelf inventory capacity.</li>
                            <li><strong className="text-foreground">Unit</strong> (optional) — E.g. each, box, carton (defaults to box).</li>
                            <li><strong className="text-foreground">Supplier Name</strong> (optional) — Existing supplier name in directory (auto-resolves).</li>
                            <li><strong className="text-foreground">Ordering Method</strong> (optional) — E.g. portal, phone, sms, email, rep, metcash.</li>
                            <li><strong className="text-foreground">Default Order Qty</strong> (optional) — Fallback replenishment order size.</li>
                            <li><strong className="text-foreground">Ordering Instruction</strong> (optional) — Special comments for staff.</li>
                        </ul>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* File Upload Option */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileSpreadsheet className="h-5 w-5 text-brand" /> Excel Spreadsheet
                            </CardTitle>
                            <CardDescription>Upload a local Excel file (.xlsx) from your device.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleUploadFile} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="excel_file">Select Spreadsheet file</Label>
                                    <Input
                                        id="excel_file"
                                        type="file"
                                        accept=".xlsx"
                                        onChange={handleFileChange}
                                        disabled={isUploading}
                                        className="h-10 cursor-pointer pt-2"
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    disabled={!file || isUploading}
                                    loading={isUploading && !!file}
                                    className="w-full font-semibold"
                                >
                                    <Upload className="mr-1.5 h-4 w-4" /> Upload & Import
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Google Sheets Link Option */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Globe className="h-5 w-5 text-indigo-500" /> Google Sheets
                            </CardTitle>
                            <CardDescription>Link a public Google Sheet (Make sure Anyone with Link can View).</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleUploadUrl} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="sheets_url">Google Sheet Share Link</Label>
                                    <Input
                                        id="sheets_url"
                                        type="url"
                                        value={sheetUrl}
                                        onChange={(e) => setSheetUrl(e.target.value)}
                                        placeholder="https://docs.google.com/spreadsheets/d/..."
                                        disabled={isUploading}
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    disabled={!sheetUrl.trim() || isUploading}
                                    loading={isUploading && !file}
                                    variant="outline"
                                    className="w-full font-semibold"
                                >
                                    <Globe className="mr-1.5 h-4 w-4" /> Link & Import
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* Import loading spinner */}
                {isUploading && (
                    <Card className="border border-brand/20 bg-brand/5">
                        <CardContent className="p-8 flex flex-col items-center justify-center space-y-3">
                            <Loader2 className="h-8 w-8 animate-spin text-brand" />
                            <div className="text-center space-y-1">
                                <p className="font-bold">Analyzing Workbook...</p>
                                <p className="text-xs text-muted-foreground">
                                    Parsing sheets, matching columns, resolving suppliers, and writing records to database.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Results Screen */}
                {importResult && importResult.success && importResult.summary && (
                    <Card className="border border-green-200 bg-green-50/10 dark:border-green-950/30">
                        <CardHeader className="flex flex-row items-center gap-3">
                            <CheckCircle className="h-6 w-6 text-green-500 shrink-0" />
                            <div>
                                <CardTitle className="text-green-800 dark:text-green-400">Import Completed</CardTitle>
                                <CardDescription>Workbook parsing ended with the following results.</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-5 pt-0">
                            {/* Summary boxes */}
                            <div className="grid grid-cols-3 gap-4 border-b pb-4 text-center font-bold text-xs">
                                <div className="p-3 bg-card border rounded-xl">
                                    <p className="text-muted-foreground mb-1 uppercase tracking-wide">Categories</p>
                                    <p className="text-xl text-brand font-extrabold">{importResult.summary.categoriesCount}</p>
                                </div>
                                <div className="p-3 bg-card border rounded-xl">
                                    <p className="text-muted-foreground mb-1 uppercase tracking-wide">Products Upserted</p>
                                    <p className="text-xl text-green-600 font-extrabold">{importResult.summary.itemsCount}</p>
                                </div>
                                <div className="p-3 bg-card border rounded-xl">
                                    <p className="text-muted-foreground mb-1 uppercase tracking-wide">Failed Rows</p>
                                    <p className={`text-xl font-extrabold ${importResult.summary.errorsCount > 0 ? "text-red-500" : "text-slate-400"}`}>
                                        {importResult.summary.errorsCount}
                                    </p>
                                </div>
                            </div>

                            {/* Details per Tab */}
                            {importResult.results && (
                                <div className="space-y-4">
                                    <h4 className="font-bold text-sm text-foreground">Category Parsing Summary:</h4>
                                    <div className="space-y-3">
                                        {Object.entries(importResult.results).map(([catName, details]) => {
                                            const hasErrors = details.errors && details.errors.length > 0;
                                            return (
                                                <div key={catName} className="p-3 bg-card border rounded-xl space-y-2">
                                                    <div className="flex justify-between items-center text-xs font-semibold">
                                                        <span className="font-bold text-sm text-foreground">{catName}</span>
                                                        <span className="text-muted-foreground">
                                                            {details.successCount} upserted rows
                                                        </span>
                                                    </div>

                                                    {hasErrors && (
                                                        <div className="bg-red-50/50 border border-red-100 p-2.5 rounded-lg text-xs space-y-1.5 dark:bg-red-950/10 dark:border-red-900/30">
                                                            <div className="font-bold text-red-800 dark:text-red-300 flex items-center gap-1">
                                                                <AlertCircle className="h-3 w-3" /> Parsing Failures ({details.errors.length}):
                                                            </div>
                                                            <ul className="list-disc pl-4 text-red-700 space-y-1 dark:text-red-400">
                                                                {details.errors.slice(0, 3).map((err, i) => (
                                                                    <li key={i}>
                                                                        Row {err.row}: {err.error}
                                                                    </li>
                                                                ))}
                                                                {details.errors.length > 3 && (
                                                                    <li className="italic list-none pl-1">
                                                                        ...and {details.errors.length - 3} more errors
                                                                    </li>
                                                                )}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end pt-2">
                                <Button asChild className="font-semibold text-xs h-8">
                                    <Link href={`${basePath}/categories`}>
                                        Go to Setup <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </DashboardLayout>
    );
}
