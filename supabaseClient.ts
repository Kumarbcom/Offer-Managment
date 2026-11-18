// Access the global variable exposed by the CDN script tag in index.html
// This avoids ESM dependency resolution issues (like AuthClient null) in browser environments.
const globalSupabase = (window as any).supabase;

const supabaseUrl = 'https://jzdpbaornpkrgwwelvqa.supabase.co';
// Publishable key for project jzdpbaornpkrgwwelvqa (enquiry@siddhikabel.com)
const supabaseAnonKey = 'sb_publishable_GeFTcwQrbVoqOz0huLdOaA_aghUoxzn';

let client = null;

try {
    if (globalSupabase && globalSupabase.createClient) {
        client = globalSupabase.createClient(supabaseUrl, supabaseAnonKey);
    } else {
        console.warn("Supabase createClient not found. Ensure the CDN script is loaded.");
    }
} catch (error) {
    console.error("Failed to initialize Supabase client:", error);
}

// Initialize only if createClient is available to prevent runtime crash
export const supabase = client;

export const supabaseConfig = {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
};
