// Access the global variable exposed by the CDN script tag in index.html
// This avoids ESM dependency resolution issues (like AuthClient null) in browser environments.
const globalSupabase = (window as any).supabase;

const supabaseUrl = 'https://vojuwzvxblxqavnpxzsj.supabase.co';
// Publishable key for project vojuwzvxblxqavnpxzsj
const supabaseAnonKey = 'sb_publishable_5gS-xt8Puw7-jgzr6rAHOQ_4LN9_xL3';

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
