
// Access the global variable exposed by the CDN script tag in index.html
// This avoids ESM dependency resolution issues (like AuthClient null) in browser environments.
const globalSupabase = (window as any).supabase;

const supabaseUrl = 'https://hrvjlqqldbgzlvqavwwl.supabase.co';
// This is an anon key, it's safe to be public.
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydmpscXFsZGJnemx2cWF2d3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNDU1OTksImV4cCI6MjA3ODkyMTU5OX0.qW6P4aQbVjhKEZLzyoIYnPcxn-ZALfdq_JJi-_Fb2PA';

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
