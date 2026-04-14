import React, { useState, useEffect } from 'react';
import { supabase, supabaseConfig } from '../supabaseClient';
import { toSupabaseTableName } from '../supabase';

export const StorageManager: React.FC = () => {
    const [usage, setUsage] = useState<{ key: string, size: number }[]>([]);
    const [totalUsage, setTotalUsage] = useState(0);
    const [dbStatus, setDbStatus] = useState<{ table: string, status: 'ok' | 'error' | 'checking' }[]>([]);
    const [isConfigured, setIsConfigured] = useState(false);

    const checkUsage = () => {
        const items: { key: string, size: number }[] = [];
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                const val = localStorage.getItem(key) || '';
                const size = val.length * 2; 
                items.push({ key, size });
                total += size;
            }
        }
        setUsage(items.sort((a, b) => b.size - a.size));
        setTotalUsage(total);
    };

    const checkSupabase = async () => {

        const configured = !!(supabaseConfig.url && !supabaseConfig.url.includes('YOUR_PROJECT_ID'));
        setIsConfigured(configured);
        if (!configured || !supabase) return;

        const tables = ['quotations', 'customers', 'products', 'users'] as const;
        setDbStatus(tables.map(t => ({ table: t, status: 'checking' })));

        for (const table of tables) {
            try {
                const { error } = await supabase.from(toSupabaseTableName(table)).select('id').limit(1);
                setDbStatus(prev => prev.map(s => s.table === table ? { ...s, status: error ? 'error' : 'ok' } : s));
            } catch (e) {
                setDbStatus(prev => prev.map(s => s.table === table ? { ...s, status: 'error' } : s));
            }
        }
    };

    useEffect(() => {
        checkUsage();
        checkSupabase();
    }, []);


    const clearKey = (key: string) => {
        if (window.confirm(`Are you sure you want to clear "${key}"? This will delete local data for this table.`)) {
            localStorage.removeItem(key);
            checkUsage();
        }
    };

    const clearAll = () => {
        if (window.confirm("CRITICAL: This will clear ALL local data and logout. You will lose any unsaved changes. Proceed?")) {
            localStorage.clear();
            window.location.reload();
        }
    }

    const optimizeStorage = () => {
        if (window.confirm("This will clear local backups (quotations, etc.) but KEEP your Logo. Proceed to free up space?")) {
            const keysToKeep = ['company_logo', 'sb-token', 'supabase.auth.token'];
            let clearedCount = 0;
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && !keysToKeep.some(k => key.includes(k))) {
                    localStorage.removeItem(key);
                    clearedCount++;
                }
            }
            alert(`Cleared ${clearedCount} local data items.`);
            checkUsage();
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    // Calculate percentage of 5MB limit
    const percent = Math.min(100, (totalUsage / (5 * 1024 * 1024)) * 100);

    return (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800">Local Browser Storage</h3>
                    <div className="flex gap-2">
                        <button 
                            onClick={optimizeStorage}
                            className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg border border-indigo-100 hover:bg-indigo-100 font-bold"
                        >
                            Optimize
                        </button>
                        <button 
                            onClick={clearAll}
                            className="text-xs bg-red-50 text-red-600 px-3 py-1 rounded-lg border border-red-100 hover:bg-red-100 font-bold"
                        >
                            Reset All
                        </button>
                    </div>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                    "Optimize" clears backups while keeping your Logo. Data syncs automatically to Supabase.
                </p>
            </div>

            <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>Usage: {formatSize(totalUsage)} / 5 MB</span>
                    <span>{percent.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all ${percent > 90 ? 'bg-red-500' : percent > 70 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                        style={{ width: `${percent}%` }}
                    ></div>
                </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {usage.map(item => (
                    <div key={item.key} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg text-sm border border-slate-100 group">
                        <div className="flex flex-col">
                            <span className="font-bold text-slate-700">{item.key}</span>
                            <span className="text-[10px] text-slate-500">{formatSize(item.size)}</span>
                        </div>
                        <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={() => clearKey(item.key)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title="Delete local backup"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            
            <p className="text-[10px] text-slate-400 italic">
                Note: Local storage is a backup. If you have Supabase connectivity, data should be synced online.
            </p>

            <div className="pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    Supabase Connectivity
                </h4>
                {!isConfigured ? (
                    <div className="p-2 bg-red-50 text-red-600 rounded text-[10px] font-bold">
                        Supabase is NOT configured. All data is being saved locally.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        {dbStatus.map(s => (
                            <div key={s.table} className="flex items-center justify-between p-1.5 bg-slate-50 rounded border border-slate-100">
                                <span className="text-[10px] text-slate-600 font-medium capitalize">{s.table}</span>
                                {s.status === 'checking' ? (
                                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-pulse"></div>
                                ) : s.status === 'ok' ? (
                                    <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
                                ) : (
                                    <div className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_5px_rgba(239,68,68,0.5)]"></div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                <p className="text-[9px] text-slate-400 mt-2 leading-tight">
                    Red lights indicate missing tables in your Supabase project. Ensure your database schema is up to date.
                </p>
            </div>
        </div>
    );
};

