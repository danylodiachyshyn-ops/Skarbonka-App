# Google OAuth (Sign in with Google) – Fix redirect_uri_mismatch (400)

Error **400 redirect_uri_mismatch** means Google is rejecting the redirect URI that Supabase sends. You must add **Supabase’s callback URL** in **Google Cloud Console**, and your **app’s redirect URL** in **Supabase**.

---

## 1. Google Cloud Console (fixes 400 redirect_uri_mismatch)

1. Open [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
2. Open your **OAuth 2.0 Client ID** (type **Web application** – the one used for Supabase Google provider).
3. Under **Authorized redirect URIs** click **+ ADD URI** and add:
   ```text
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```
   Replace `YOUR_PROJECT_REF` with your Supabase project reference (from Supabase URL: `https://YOUR_PROJECT_REF.supabase.co`).
4. Save.

---

## 2. Supabase Dashboard

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **URL Configuration**.
2. Under **Redirect URLs** add your app’s redirect URL(s):

   **Option A: Using Expo Go (development)**
   - Run: `npx expo start --tunnel` (creates HTTPS tunnel URL)
   - When you tap “Sign in with Google”, check the console – it will log the redirect URL
   - Add that HTTPS URL (e.g., `https://xxx-xxx.exp.direct/--/auth/callback`) to Supabase Redirect URLs
   - **Note:** Safari can’t handle `exp://` URLs, so you must use `--tunnel` for Expo Go

   **Option B: Using Development Build (recommended)**
   - Use custom scheme: `skarbonka://auth/callback`
   - Add this to Supabase Redirect URLs
   - Works in both dev and production

   **Tip:** Add both URLs if you test in different environments.
3. Save.

---

## Summary

| Where | URL to add |
|-------|------------|
| **Google Cloud Console** → Credentials → OAuth client → Authorized redirect URIs | `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` |
| **Supabase** → Auth → URL Configuration → Redirect URLs | `skarbonka://auth/callback` (and dev URL from console log if needed) |

After updating both, try “Sign in with Google” again.
