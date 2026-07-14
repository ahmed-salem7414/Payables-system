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

  // If we are running in an external frontend environment (e.g. Vercel),
  // automatically default to the Cloud Run backend URL.
  const hostname = window.location.hostname.toLowerCase();
  const isLocalOrDevelopment = 
    hostname === "localhost" || 
    hostname === "127.0.0.1" || 
    hostname.endsWith("run.app") ||
    hostname.includes("googleusercontent.com") ||
    hostname.includes("google.com") ||
    hostname === "";

  if (!isLocalOrDevelopment) {
    const defaultBackend = "https://ais-pre-q3mtusmun2tsb5rur7bk5w-88619399054.europe-west2.run.app";
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${defaultBackend}${cleanPath}`;
  }

  return path;
}

/**
 * Checks if the app is currently running on a Vercel or other external deployment.
 */
export function isVercelEnvironment(): boolean {
  const hostname = window.location.hostname.toLowerCase();
  const isLocalOrDevelopment = 
    hostname === "localhost" || 
    hostname === "127.0.0.1" || 
    hostname.endsWith("run.app") ||
    hostname.includes("googleusercontent.com") ||
    hostname.includes("google.com") ||
    hostname === "";
  return !isLocalOrDevelopment;
}
