import { NextRequest } from 'next/server';

/**
 * Gets the base URL for the application.
 * If a request is provided, it derives the URL from the request.
 * Otherwise, it prioritizes NEXT_PUBLIC_SITE_URL, then NEXT_PUBLIC_VERCEL_URL,
 * and finally falls back to localhost.
 */
export function getSiteUrl(request?: NextRequest) {
  // If we have a request, use it to get the site URL
  if (request) {
    try {
      const protocol = request.nextUrl.protocol;
      const host = request.nextUrl.host; // includes port if any
      // Remove trailing slash if any
      return `${protocol}//${host}`.replace(/\/$/, '');
    } catch (e) {
      console.warn('Failed to derive site URL from request:', e);
    }
  }

  // Fallback to environment variables
  let url =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    'http://localhost:3000';

  // Ensure the URL has a protocol
  if (!url.startsWith('http')) {
    url = `https://${url}`;
  }

  // Remove trailing slash if present
  return url.replace(/\/$/, '');
}
