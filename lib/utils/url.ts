/**
 * Gets the base URL for the application.
 * Prioritizes NEXT_PUBLIC_SITE_URL, then NEXT_PUBLIC_VERCEL_URL for Vercel deployments,
 * and finally falls back to localhost for development.
 */
export function getSiteUrl() {
  let url =
    process.env.NEXT_PUBLIC_SITE_URL ?? // Custom site URL
    process.env.NEXT_PUBLIC_VERCEL_URL ?? // Automatically set by Vercel
    'http://localhost:3000';

  // Ensure the URL has a protocol
  if (!url.startsWith('http')) {
    url = `https://${url}`;
  }

  // Remove trailing slash if present
  return url.replace(/\/$/, '');
}
