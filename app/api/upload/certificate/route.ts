import { NextRequest } from 'next/server';
import { requireRole, getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { uploadBuffer } from '@/lib/storage';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/upload/certificate
 * 
 * Upload a certificate file (RSA, Food Safety, First Aid, etc.)
 * Access: Owner, Manager (for their employees), Employee (for themselves)
 * 
 * Form Data:
 *   file: File
 *   employee_id: string
 *   certificate_type: "RSA" | "food_safety" | "first_aid" | "other"
 *   issue_date: "YYYY-MM-DD"
 *   expiry_date: "YYYY-MM-DD" (optional)
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) return errorResponse('Unauthorized', 401);

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const employee_id = formData.get('employee_id') as string;
        const certificate_type = formData.get('certificate_type') as string;
        const issue_date = formData.get('issue_date') as string;
        const expiry_date = formData.get('expiry_date') as string | null;

        if (!file) return errorResponse('File is required', 400);
        if (!employee_id) return errorResponse('employee_id is required', 400);
        if (!certificate_type) return errorResponse('certificate_type is required', 400);
        if (!issue_date) return errorResponse('issue_date is required', 400);

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            return errorResponse('File size must be under 10MB', 400);
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            return errorResponse('File must be JPEG, PNG, WebP, or PDF', 400);
        }

        // Security: Employees can only upload their own certificates
        if (authUser.role !== 'owner' && authUser.role !== 'manager') {
            if (authUser.employee_id !== employee_id) {
                return errorResponse('You can only upload your own certificates', 403);
            }
        }

        // Upload to Supabase Storage
        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await uploadBuffer(
            'certificates',
            buffer,
            file.name,
            file.type,
            employee_id
        );

        // Save certificate record to DB
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('Certificate')
            .insert({
                employee_id,
                certificate_type,
                file_url: result.url,
                issue_date,
                expiry_date: expiry_date || null,
            })
            .select()
            .single();

        if (error) return errorResponse(error.message);
        return successResponse(data, 'Certificate uploaded successfully', 201);
    } catch (err: any) {
        console.error('Certificate upload error:', err);
        return errorResponse(err.message, 500);
    }
}
