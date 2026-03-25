import { ApiResponse } from "@/types/database";

const BASE_URL = "/api";

/**
 * Generic API client for calling our Next.js API routes.
 * Used by TanStack Query hooks.
 */
export async function apiClient<T = unknown>(
    endpoint: string,
    options?: RequestInit
): Promise<T> {
    const url = endpoint.startsWith("/") ? `${BASE_URL}${endpoint}` : `${BASE_URL}/${endpoint}`;

    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            ...options?.headers,
        },
        ...options,
    });

    const data: ApiResponse<T> = await response.json();

    if (!data.success) {
        throw new Error(data.error || data.message || "Something went wrong");
    }

    return data.data as T;
}

/**
 * GET request helper
 */
export function apiGet<T = unknown>(endpoint: string, params?: Record<string, string>) {
    const searchParams = params ? `?${new URLSearchParams(params).toString()}` : "";
    return apiClient<T>(`${endpoint}${searchParams}`);
}

/**
 * POST request helper
 */
export function apiPost<T = unknown>(endpoint: string, body?: unknown) {
    return apiClient<T>(endpoint, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
    });
}

/**
 * PUT request helper
 */
export function apiPut<T = unknown>(endpoint: string, body?: unknown) {
    return apiClient<T>(endpoint, {
        method: "PUT",
        body: body ? JSON.stringify(body) : undefined,
    });
}

/**
 * PATCH request helper
 */
export function apiPatch<T = unknown>(endpoint: string, body?: unknown) {
    return apiClient<T>(endpoint, {
        method: "PATCH",
        body: body ? JSON.stringify(body) : undefined,
    });
}

/**
 * DELETE request helper
 */
export function apiDelete<T = unknown>(endpoint: string) {
    return apiClient<T>(endpoint, {
        method: "DELETE",
    });
}

/**
 * Upload file via FormData (for certificates, documents, avatars)
 */
export async function apiUpload<T = unknown>(
    endpoint: string,
    formData: FormData
): Promise<T> {
    const url = endpoint.startsWith("/") ? `${BASE_URL}${endpoint}` : `${BASE_URL}/${endpoint}`;

    const response = await fetch(url, {
        method: "POST",
        body: formData,
        // Don't set Content-Type — browser sets it with boundary for multipart
    });

    const data: ApiResponse<T> = await response.json();

    if (!data.success) {
        throw new Error(data.error || data.message || "Upload failed");
    }

    return data.data as T;
}
