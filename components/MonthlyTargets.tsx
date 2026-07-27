import React from 'react';
import { motion } from 'framer-motion';

export interface CustomerStats {
    total: number;
    repeated: number;
    oneTime: number;
    newCust: number;
}

export const MonthlyTargets: React.FC<{ onClose?: () => void, stats?: CustomerStats }> = ({ onClose, stats }) => {
    const { total = 0, repeated = 0, oneTime = 0, newCust = 0 } = stats || {};

    const repeatedPct = total > 0 ? (repeated / total) * 100 : 0;
    const oneTimePct = total > 0 ? (oneTime / total) * 100 : 0;
    const newPct = total > 0 ? (newCust / total) * 100 : 0;

    const off1 = 628 - (628 * (repeatedPct / 100));
    const off2 = 502 - (502 * (oneTimePct / 100));
    const off3 = 377 - (377 * (newPct / 100));

    const formatPct = (val: number) => val > 0 ? `${val.toFixed(0)}%` : '';

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col w-full max-w-md mx-auto h-full">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-lg font-semibold text-slate-800">Customer Distribution</h2>
                <div className="flex items-center gap-2">
                    {onClose && (
                        <button onClick={onClose} className="p-1 bg-slate-800 text-white rounded-md hover:bg-slate-700 transition-colors flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Radial Chart */}
            <div className="relative flex justify-center items-center py-4 mb-6">
                <svg width="240" height="240" viewBox="0 0 240 240" className="transform -rotate-90">
                    {/* Background circles */}
                    <circle cx="120" cy="120" r="100" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                    <circle cx="120" cy="120" r="80" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                    <circle cx="120" cy="120" r="60" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                    
                    {/* Foreground circles */}
                    <circle cx="120" cy="120" r="100" fill="none" stroke="#5462ff" strokeWidth="12" strokeDasharray="628" strokeDashoffset={off1} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                    <circle cx="120" cy="120" r="80" fill="none" stroke="#e77fb3" strokeWidth="12" strokeDasharray="502" strokeDashoffset={off2} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                    <circle cx="120" cy="120" r="60" fill="none" stroke="#f3a4d6" strokeWidth="12" strokeDasharray="377" strokeDashoffset={off3} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                    
                    {/* Data Labels (un-rotate by 90deg) */}
                    <g transform="rotate(90 120 120)">
                        <text x="120" y="15" fill="#5462ff" fontSize="12" fontWeight="bold" dominantBaseline="middle" textAnchor="middle">{formatPct(repeatedPct)}</text>
                        <text x="120" y="35" fill="#e77fb3" fontSize="12" fontWeight="bold" dominantBaseline="middle" textAnchor="middle">{formatPct(oneTimePct)}</text>
                        <text x="120" y="55" fill="#f3a4d6" fontSize="12" fontWeight="bold" dominantBaseline="middle" textAnchor="middle">{formatPct(newPct)}</text>
                    </g>
                </svg>

                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-sm font-semibold text-slate-800">Customers</span>
                    <span className="text-xl font-medium text-slate-600">{total}</span>
                </div>
            </div>

            {/* Bottom Stats */}
            <div className="bg-slate-50/80 rounded-xl p-4 flex justify-between items-center mt-auto">
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-2 h-2 rounded-full bg-[#5462ff]"></div>
                        <span className="text-[13px] text-slate-600 font-medium text-center">Repeated<br/>Customer</span>
                    </div>
                    <span className="text-[17px] font-semibold text-slate-800">{repeated}</span>
                </div>

                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-2 h-2 rounded-full bg-[#e77fb3]"></div>
                        <span className="text-[13px] text-slate-600 font-medium text-center">One Time<br/>Customer</span>
                    </div>
                    <span className="text-[17px] font-semibold text-slate-800">{oneTime}</span>
                </div>

                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-2 h-2 rounded-full bg-[#f3a4d6]"></div>
                        <span className="text-[13px] text-slate-600 font-medium text-center">New<br/>Customer</span>
                    </div>
                    <span className="text-[17px] font-semibold text-slate-800">{newCust}</span>
                </div>
            </div>
        </div>
    );
};
