import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { uploadBuffer } from '@/lib/storage';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/upload/avatar
 * 
 * Upload a profile photo
 * Access: Any authenticated user (uploads for themselves)
 * 
 * Form Data:
 *   file: File (image only)
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) return errorResponse('Unauthorized', 401);

        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) return errorResponse('File is required', 400);

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            return errorResponse('Avatar must be under 2MB', 400);
        }

        // Images only
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            return errorResponse('Avatar must be JPEG, PNG, or WebP', 400);
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await uploadBuffer(
            'avatars',
            buffer,
            file.name,
            file.type,
            authUser.user_id
        );

        // Optionally update employee's profile with avatar URL
        if (authUser.employee_id) {
            const supabase = await createClient();
            await supabase
                .from('Employee')
                .update({ avatar_url: result.url, updated_at: new Date().toISOString() })
                .eq('employee_id', authUser.employee_id);
        }

        return successResponse({
            url: result.url,
            path: result.path,
        }, 'Avatar uploaded successfully', 201);
    } catch (err: any) {
        console.error('Avatar upload error:', err);
        return errorResponse(err.message, 500);
    }
}
