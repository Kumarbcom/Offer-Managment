// The global supabase object is attached to window by the CDN script.
// We need to tell TypeScript about it.
declare global {
    interface Window {
        supabase: any;
    }
}

const supabaseUrl = 'https://hrvjlqqldbgzlvqavwwl.supabase.co';
// This is an anon key, it's safe to be public.
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydmpscXFsZGJnemx2cWF2d3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNDU1OTksImV4cCI6MjA3ODkyMTU5OX0.qW6P4aQbVjhKEZLzyoIYnPcxn-ZALfdq_JJi-_Fb2PA';


export const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

export const supabaseConfig = {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
};
