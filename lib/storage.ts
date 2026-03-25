import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Supabase Storage helper
 * Handles file uploads to Supabase Storage buckets
 * 
 * Buckets needed (create in Supabase Dashboard → Storage):
 * - "certificates"  (for RSA, food_safety, first_aid docs)
 * - "documents"     (for leave request medical certificates)
 * - "avatars"       (for profile photos)
 */

export type StorageBucket = 'certificates' | 'documents' | 'avatars';

interface UploadResult {
    url: string;
    path: string;
}

/**
 * Upload a file to a Supabase Storage bucket.
 * Returns the public URL.
 */
export async function uploadFile(
    bucket: StorageBucket,
    file: File,
    folder: string // e.g. "EMP001" or "business_123"
): Promise<UploadResult> {
    const supabase = createAdminClient();

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'bin';
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
        });

    if (error) {
        throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

    return {
        url: urlData.publicUrl,
        path: data.path,
    };
}

/**
 * Upload a file from a Buffer/ArrayBuffer (for server-side API routes).
 */
export async function uploadBuffer(
    bucket: StorageBucket,
    buffer: Buffer,
    fileName: string,
    contentType: string,
    folder: string
): Promise<UploadResult> {
    const supabase = createAdminClient();

    const ext = fileName.split('.').pop() || 'bin';
    const storagePath = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(storagePath, buffer, {
            cacheControl: '3600',
            upsert: false,
            contentType,
        });

    if (error) {
        throw new Error(`Upload failed: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

    return {
        url: urlData.publicUrl,
        path: data.path,
    };
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFile(bucket: StorageBucket, path: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
        throw new Error(`Delete failed: ${error.message}`);
    }
}
