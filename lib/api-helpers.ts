import { NextResponse } from 'next/server';

// Helper to create consistent API responses
export function successResponse<T>(data: T, message?: string, status = 200) {
    return NextResponse.json(
        { success: true, data, message },
        { status }
    );
}

export function errorResponse(error: string, status = 400, data?: any) {
    return NextResponse.json(
        { success: false, error, ...data },
        { status }
    );
}

// Helper to validate required fields
export function validateRequiredFields(
    body: Record<string, unknown>,
    fields: string[]
): string | null {
    const missing = fields.filter(
        (field) => body[field] === undefined || body[field] === null || body[field] === ''
    );
    if (missing.length > 0) {
        return `Missing required fields: ${missing.join(', ')}`;
    }
    return null;
}
