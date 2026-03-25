import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { uploadBuffer } from '@/lib/storage';

/**
 * POST /api/upload/document
 * 
 * Upload a leave request supporting document (medical certificate, etc.)
 * Access: Any authenticated user
 * 
 * Form Data:
 *   file: File
 *   leave_request_id: string (optional — can attach later)
 * 
 * Returns: { url, path }
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) return errorResponse('Unauthorized', 401);

        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) return errorResponse('File is required', 400);

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return errorResponse('File size must be under 5MB', 400);
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            return errorResponse('File must be JPEG, PNG, WebP, or PDF', 400);
        }

        // Upload to Supabase Storage
        const buffer = Buffer.from(await file.arrayBuffer());
        const folder = authUser.employee_id || authUser.user_id;
        const result = await uploadBuffer(
            'documents',
            buffer,
            file.name,
            file.type,
            folder
        );

        return successResponse({
            url: result.url,
            path: result.path,
        }, 'Document uploaded successfully', 201);
    } catch (err: any) {
        console.error('Document upload error:', err);
        return errorResponse(err.message, 500);
    }
}
