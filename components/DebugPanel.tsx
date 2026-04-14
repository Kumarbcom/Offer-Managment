
import React from 'react';

interface DebugPanelProps {
    error: any;
    lastAction?: string;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ error, lastAction }) => {
    if (!error) return null;

    const errorDetails = typeof error === 'object' ? JSON.stringify(error, null, 2) : String(error);

    return (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl font-mono text-[10px] text-red-800 overflow-auto max-h-60 shadow-inner">
            <h3 className="font-bold border-b border-red-200 pb-1 mb-2 uppercase tracking-wider flex justify-between">
                <span>Critical Sync Error</span>
                {lastAction && <span className="text-red-400">Action: {lastAction}</span>}
            </h3>
            <pre className="whitespace-pre-wrap break-all leading-relaxed">
                {errorDetails}
            </pre>
            <div className="mt-4 p-2 bg-white rounded border border-red-100 italic text-slate-500">
                <p className="font-bold flex items-center gap-1 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    How to fix this:
                </p>
                1. If it says "permission denied", you may need to disable RLS for the 'quotations' table in Supabase.<br/>
                2. If it says "column not found", check if your Supabase table matches the app's fields.<br/>
                3. If it says "network error", please check your internet connection.
            </div>
        </div>
    );
};
