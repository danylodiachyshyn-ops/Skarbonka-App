/**
 * OAuth callback URL parsing for Supabase Auth.
 * Supabase redirects with tokens in the URL hash fragment.
 */
export function getSessionParamsFromUrl(url: string): {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
} {
  try {
    // Supabase puts tokens in the hash fragment: #access_token=xxx&refresh_token=xxx
    const hashIndex = url.indexOf('#');
    const queryIndex = url.indexOf('?');
    const search = hashIndex >= 0 ? url.slice(hashIndex + 1) : queryIndex >= 0 ? url.slice(queryIndex + 1) : '';
    if (!search) return {};

    const params = new URLSearchParams(search);
    const access_token = params.get('access_token') ?? undefined;
    const refresh_token = params.get('refresh_token') ?? undefined;
    const error = params.get('error') ?? undefined;
    const error_description = params.get('error_description') ?? undefined;

    return { access_token, refresh_token, error, error_description };
  } catch {
    return {};
  }
}
