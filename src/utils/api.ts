/**
 * Utility to construct the full API URL based on a user-provided or auto-detected API base URL.
 * This ensures full compatibility when running the frontend on standalone platforms like Vercel.
 */
export function getApiUrl(path: string): string {
  const savedBaseUrl = localStorage.getItem("mawrid_api_base_url");
  if (savedBaseUrl) {
    const cleanBase = savedBaseUrl.trim().endsWith("/") 
      ? savedBaseUrl.trim().slice(0, -1) 
      : savedBaseUrl.trim();
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${cleanBase}${cleanPath}`;
  }
  return path;
}

/**
 * Checks if the app is currently running on a Vercel deployment.
 */
export function isVercelEnvironment(): boolean {
  return (
    window.location.hostname.endsWith("vercel.app") ||
    window.location.hostname.includes("amplifyapp.com") ||
    window.location.hostname.includes("github.io")
  );
}
