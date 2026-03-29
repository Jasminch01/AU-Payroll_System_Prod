import axios, { AxiosError, AxiosResponse, AxiosRequestConfig } from "axios";
import { ApiResponse } from "@/types/database";


const BASE_URL = "/api";

/**
 * Singleton Axios Instance
 * Pre-configured with base URL and common headers.
 */
const axiosInstance = axios.create({
    baseURL: BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true, // Required for cross-origin cookie handling if applicable
});

/**
 * Response Interceptor: Standardizes response handling and error extraction
 * Automatically unwraps the response and handles our standard { success, data, error } format.
 */
axiosInstance.interceptors.response.use(
    (response: AxiosResponse<ApiResponse>) => {
        const result = response.data;
        // If the API returns success: false, we treat it as an error even if status is 200
        if (result.success === false) {
            return Promise.reject(new Error(result.error || result.message || "API Error"));
        }
        return response;
    },
    (error: AxiosError<ApiResponse>) => {
        // Handle Axios errors (network errors, status codes >= 400)
        // We prioritize the error message returned by our backend
        const message =
            error.response?.data?.error ||
            error.response?.data?.message ||
            error.message ||
            "Something went wrong";
        return Promise.reject(new Error(message));
    }
);

/**
 * Generic API client for calling our Next.js API routes.
 * 
 * @param endpoint - The API endpoint (e.g., "/onboarding/status")
 * @param config - Standard Axios request configuration
 * @returns The 'data' field from the ApiResponse
 */
export async function apiClient<T = unknown>(
    endpoint: string,
    config: AxiosRequestConfig = {}
): Promise<T> {
    const response = await axiosInstance({
        url: endpoint,
        ...config,
    });

    // The interceptor ensures that if we reach here, result.success is true
    return response.data.data as T;
}

/**
 * GET request helper
 */
export function apiGet<T = unknown>(endpoint: string, params?: Record<string, any>) {
    return apiClient<T>(endpoint, {
        method: "GET",
        params,
    });
}

/**
 * POST request helper
 */
export function apiPost<T = unknown>(endpoint: string, body?: unknown) {
    return apiClient<T>(endpoint, {
        method: "POST",
        data: body,
    });
}

/**
 * PUT request helper
 */
export function apiPut<T = unknown>(endpoint: string, body?: unknown) {
    return apiClient<T>(endpoint, {
        method: "PUT",
        data: body,
    });
}

/**
 * PATCH request helper
 */
export function apiPatch<T = unknown>(endpoint: string, body?: unknown) {
    return apiClient<T>(endpoint, {
        method: "PATCH",
        data: body,
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
 * Upload file via FormData (standardizes header for multipart)
 */
export async function apiUpload<T = unknown>(
    endpoint: string,
    formData: FormData
): Promise<T> {
    const response = await axiosInstance.post(endpoint, formData, {
        headers: {
            // We omit Content-Type to let Axios/Browser set it with the boundary automatically
            "Content-Type": undefined,
        },
    });

    return response.data.data as T;
}

export default axiosInstance;
