
import React, { useEffect, useRef, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Quotation, SalesPerson, QuotationStatus, User } from '../types';
import { QUOTATION_STATUSES } from '../constants';
import { getCustomersByIds, purgeQuotationsBeforeId, setSetting } from '../supabase';

// Forward declaration for Chart.js and DataLabels from CDN
declare const Chart: any;
declare const ChartDataLabels: any;

interface DashboardProps {
    quotations: Quotation[] | null;
    salesPersons: SalesPerson[] | null;
    currentUser: User;
    onLogoUpload: (url: string | null) => void;
    logoUrl: string | null;
}

const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatCurrencyCompact = (value: number | null | undefined) => {
    const val = Number(value);
    if (isNaN(val) || val === 0) return '0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
    return `₹${Math.round(val)}`;
}

const StatusIcon = ({ status, className }: { status: string, className?: string }) => {
    switch (status) {
        case 'Open':
            return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z" /></svg>;
        case 'PO received':
            return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" /></svg>;
        case 'Partial PO Received':
            return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path fillRule="evenodd" d="M2.25 13.5a8.25 8.25 0 0 1 8.25-8.25.75.75 0 0 1 .75.75v6.75H18a.75.75 0 0 1 .75.75 8.25 8.25 0 0 1-16.5 0Z" clipRule="evenodd" /><path fillRule="evenodd" d="M12.75 3a.75.75 0 0 1 .75-.75 8.25 8.25 0 0 1 8.25 8.25.75.75 0 0 1-.75.75h-7.5a.75.75 0 0 1-.75-.75V3Z" clipRule="evenodd" /></svg>;
        case 'Lost':
            return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M3.375 3C2.339 3 1.5 3.84 1.5 4.875v.75c0 1.036.84 1.875 1.875 1.875h17.25c1.035 0 1.875-.84 1.875-1.875v-.75C22.5 3.839 21.66 3 20.625 3H3.375Z" /><path fillRule="evenodd" d="M3.087 9l.54 9.176A3 3 0 0 0 6.62 21h10.757a3 3 0 0 0 2.995-2.824L20.913 9H3.087Zm6.133 2.845a.75.75 0 0 1 1.06 0l1.72 1.72 1.72-1.72a.75.75 0 1 1 1.06 1.06l-1.72 1.72 1.72 1.72a.75.75 0 1 1-1.06-1.06L12 15.685l-1.72 1.72a.75.75 0 1 1-1.06-1.06l1.72-1.72-1.72-1.72a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>;
        case 'Expired':
            return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" /></svg>;
        default:
            return null;
    }
}

export const Dashboard: React.FC<DashboardProps> = ({ quotations, salesPersons, currentUser, onLogoUpload, logoUrl }) => {

    const lineChartRef = useRef<HTMLCanvasElement>(null);
    const barChartRef = useRef<HTMLCanvasElement>(null);
    const funnelChartRef = useRef<HTMLCanvasElement>(null);
    const statusPieChartRef = useRef<HTMLCanvasElement>(null);
    const topCustomersChartRef = useRef<HTMLCanvasElement>(null);

    const [selectedSalesPersonId, setSelectedSalesPersonId] = useState<number | 'all'>('all');
    const [selectedDateRange, setSelectedDateRange] = useState<'all' | 'week' | 'month' | 'year'>('month');
    const [quotationSortType, setQuotationSortType] = useState<'latest' | 'highestValue'>('latest');
    const [barChartMode, setBarChartMode] = useState<'count' | 'value'>('count');
    const [orderStatusMode, setOrderStatusMode] = useState<'count' | 'value'>('value');
    const [performanceMode, setPerformanceMode] = useState<'count' | 'value'>('count');
    const [customerMap, setCustomerMap] = useState<Map<number, string>>(new Map());
    const [reportMode, setReportMode] = useState<'count' | 'value'>('value');
    const [isSyncing, setIsSyncing] = useState(false);

    const handleManualSync = async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        try {
            // Trigger a refresh of all data which will also trigger the merge/sync logic in useOnlineStorage
            window.location.reload();
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        if (quotations) {
            const customerIdsToFetch = [...new Set(quotations.map(q => q.customerId))]
                .filter((id): id is number => id !== null && !customerMap.has(id));

            if (customerIdsToFetch.length > 0) {
                getCustomersByIds(customerIdsToFetch).then(customers => {
                    setCustomerMap(prevMap => {
                        const newMap = new Map(prevMap);
                        customers.forEach(c => newMap.set(c.id, c.name));
                        return newMap;
                    });
                });
            }
        }
    }, [quotations, customerMap]);

    const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                if (ev.target?.result) {
                    const url = ev.target.result as string;
                    onLogoUpload(url);
                    try {
                        await setSetting('company_logo', url);
                    } catch (error) {
                        console.error("Failed to save logo to Supabase:", error);
                        alert("Failed to save logo to cloud storage. It might be too large.");
                    }
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const calculateTotalAmount = (details: Quotation['details'] | undefined): number => {
        if (!details || !Array.isArray(details)) return 0;
        return details.reduce((total, item) => {
            const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
            return total + (unitPrice * item.moq);
        }, 0);
    }

    const filteredQuotations = useMemo(() => {
        if (!quotations) return [];
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        let startDate: Date | null = null;
        if (selectedDateRange === 'week') {
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 7);
        } else if (selectedDateRange === 'month') {
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 30);
        } else if (selectedDateRange === 'year') {
            startDate = new Date(today);
            startDate.setFullYear(today.getFullYear() - 1);
        }

        if (startDate) {
            startDate.setHours(0, 0, 0, 0);
        }
        
        let currentSalesPersonId: number | undefined;
        if (currentUser.role === 'Sales Person') {
             currentSalesPersonId = salesPersons?.find(sp => sp.name === currentUser.name)?.id;
        }

        return quotations.filter(q => {
            let salesPersonMatch = true;
            if (currentUser.role === 'Sales Person') {
                if (currentSalesPersonId !== undefined) {
                     salesPersonMatch = q.salesPersonId === currentSalesPersonId;
                } else {
                    salesPersonMatch = false;
                }
            } else {
                 salesPersonMatch = selectedSalesPersonId === 'all' || q.salesPersonId === selectedSalesPersonId;
            }
            if (!salesPersonMatch) return false;
            if (selectedDateRange === 'all' || !startDate) return true;
            const quotationDate = new Date(q.quotationDate);
            return quotationDate >= startDate && quotationDate <= today;
        });
    }, [quotations, selectedSalesPersonId, selectedDateRange, currentUser, salesPersons]);

    const overallStats = useMemo(() => {
        const createInitialStats = () => ({
            total: { count: 0, value: 0 },
            ...QUOTATION_STATUSES.reduce((acc, status) => {
                acc[status] = { count: 0, value: 0 };
                return acc;
            }, {} as Record<QuotationStatus, { count: number, value: number }>)
        });

        return filteredQuotations.reduce((acc, q) => {
            const totalValue = calculateTotalAmount(q.details);
            acc.total.count += 1;
            acc.total.value += totalValue;
            if (acc[q.status]) {
                acc[q.status].count += 1;
                acc[q.status].value += totalValue;
            }
            return acc;
        }, createInitialStats());
    }, [filteredQuotations]);

    const salesPersonStats = useMemo(() => {
        if (!salesPersons) return [];
        const createInitialStats = () => ({
            total: { count: 0, value: 0 },
            ...QUOTATION_STATUSES.reduce((acc, status) => {
                acc[status] = { count: 0, value: 0 };
                return acc;
            }, {} as Record<QuotationStatus, { count: number, value: number }>)
        });

        return salesPersons.map(sp => {
            const personQuotations = filteredQuotations.filter(q => q.salesPersonId === sp.id);
            const personStats = personQuotations.reduce((acc, q) => {
                const totalValue = calculateTotalAmount(q.details);
                acc.total.count += 1;
                acc.total.value += totalValue;
                if (acc[q.status]) {
                    acc[q.status].count += 1;
                    acc[q.status].value += totalValue;
                }
                return acc;
            }, createInitialStats());

            return { id: sp.id, name: sp.name, ...personStats };
        });
    }, [filteredQuotations, salesPersons]);

    const getRangeLabel = () => {
        switch(selectedDateRange) {
            case 'week': return 'Last 7 Days';
            case 'month': return 'Last 30 Days';
            case 'year': return 'Last 1 Year';
            default: return 'All Time';
        }
    };

    const handlePurgeOldData = async () => {
        if (!window.confirm("Are you sure you want to PERMANENTLY delete all quotations before ID 2363? This cannot be undone.")) return;
        try {
            await purgeQuotationsBeforeId(2363);
            alert("Old quotations purged successfully.");
            window.location.reload(); // Refresh to show changes
        } catch (error) {
            console.error("Failed to purge old data:", error);
            alert("Failed to purge old data. Check console for details.");
        }
    };

    if (!quotations || !salesPersons) return <div className="text-center p-8 text-black font-bold">Synchronizing database...</div>;

    // Chart initialization logic
    useEffect(() => {
        if (!filteredQuotations || filteredQuotations.length === 0) return;

        // Register DataLabels plugin
        if (typeof ChartDataLabels !== 'undefined') {
            Chart.register(ChartDataLabels);
        }

        const charts: any[] = [];

        const destroyCharts = () => {
            charts.forEach(chart => chart.destroy());
            charts.length = 0;
        };

        // 1. Funnel Chart (Status Distribution)
        if (funnelChartRef.current) {
            const ctx = funnelChartRef.current.getContext('2d');
            if (ctx) {
                const data = QUOTATION_STATUSES.map(status => reportMode === 'count' ? overallStats[status].count : overallStats[status].value);
                charts.push(new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: QUOTATION_STATUSES,
                        datasets: [{
                            label: reportMode === 'count' ? 'Quotations' : 'Value (₹)',
                            data: data,
                            backgroundColor: ['#3b82f6', '#10b981', '#14b8a6', '#f43f5e', '#f59e0b'],
                            borderRadius: 6
                        }]
                    },
                    options: {
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { 
                            legend: { display: false },
                            datalabels: {
                                color: '#fff',
                                font: { weight: 'bold', size: 10 },
                                anchor: 'end',
                                align: 'start',
                                offset: 4,
                                formatter: (value: any) => value > 0 ? (reportMode === 'count' ? value : formatCurrencyCompact(value)) : ''
                            }
                        },
                        scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, callback: (v: any) => reportMode === 'count' ? v : formatCurrencyCompact(v) } }, y: { grid: { display: false }, ticks: { font: { size: 10 } } } }
                    }
                }));
            }
        }

        // 2. Value Trend (Line Chart)
        if (lineChartRef.current) {
            const ctx = lineChartRef.current.getContext('2d');
            if (ctx) {
                const sortedByDate = [...filteredQuotations].sort((a, b) => new Date(a.quotationDate).getTime() - new Date(b.quotationDate).getTime());
                const dateGroups = sortedByDate.reduce((acc, q) => {
                    const date = q.quotationDate;
                    acc[date] = (acc[date] || 0) + calculateTotalAmount(q.details);
                    return acc;
                }, {} as Record<string, number>);

                const labels = Object.keys(dateGroups);
                const values = Object.values(dateGroups);

                charts.push(new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels.map(l => new Date(l).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })),
                        datasets: [{
                            label: 'Daily Value',
                            data: values,
                            borderColor: '#6366f1',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            fill: true,
                            tension: 0.4,
                            pointRadius: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: { x: { grid: { display: false }, ticks: { font: { size: 8 }, maxRotation: 45 } }, y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 8 }, callback: (v: any) => formatCurrencyCompact(v) } } }
                    }
                }));
            }
        }

        // 3. Top 5 Customers
        if (topCustomersChartRef.current) {
            const ctx = topCustomersChartRef.current.getContext('2d');
            if (ctx) {
                const customerValues = filteredQuotations.reduce((acc, q) => {
                    if (q.customerId) {
                        const name = customerMap.get(q.customerId) || `Cust ${q.customerId}`;
                        acc[name] = (acc[name] || 0) + calculateTotalAmount(q.details);
                    }
                    return acc;
                }, {} as Record<string, number>);

                const top5 = Object.entries(customerValues)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5);

                charts.push(new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: top5.map(([name]) => name),
                        datasets: [{
                            data: top5.map(([, val]) => val),
                            backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b']
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { 
                            legend: { position: 'right', labels: { boxWidth: 10, font: { size: 9 } } },
                            datalabels: {
                                color: '#fff',
                                font: { weight: 'bold', size: 9 },
                                formatter: (value: any, ctx: any) => {
                                    const sum = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
                                    const percentage = (value * 100 / sum).toFixed(0) + "%";
                                    return percentage;
                                }
                            }
                        },
                        cutout: '60%'
                    }
                }));
            }
        }

        return destroyCharts;
    }, [filteredQuotations, overallStats, customerMap, reportMode]);

    return (
        <div className="space-y-3 p-1 md:p-3">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 p-1.5 rounded-lg shadow-sm">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-extrabold text-black tracking-tight">Dashboard</h2>
                                <div className="flex items-center" title="Live Database Connection Active">
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <span className="text-[10px] bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded font-extrabold text-indigo-700">Lifetime Total: {quotations.length}</span>
                                <span className="text-[10px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-bold text-slate-600">{getRangeLabel()}: {filteredQuotations.length}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
                    {/* Company Logo Upload Section */}
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                        <div className="w-10 h-8 flex items-center justify-center bg-slate-50 rounded border border-dashed border-slate-200 overflow-hidden shrink-0">
                            {logoUrl ? <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" /> : <span className="text-[8px] text-slate-400 font-bold">No Logo</span>}
                        </div>
                        <label className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 cursor-pointer uppercase tracking-tight">
                            {logoUrl ? 'Change Logo' : 'Upload Logo'}
                            <input type="file" className="hidden" accept="image/*" onChange={handleLogoChange} />
                        </label>
                        {logoUrl && (
                            <button onClick={async () => {
                                onLogoUpload(null);
                                try {
                                    await setSetting('company_logo', null);
                                } catch (error) {
                                    console.error("Failed to remove logo from Supabase:", error);
                                }
                            }} className="text-[10px] text-rose-500 font-bold hover:text-rose-600 ml-1">
                                ✕
                            </button>
                        )}
                    </div>

                    <div className="relative w-full md:w-64">
                        <select aria-label="Filter by Sales Person" value={selectedSalesPersonId} onChange={(e) => setSelectedSalesPersonId(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="block w-full pl-4 pr-10 py-2 text-sm border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg bg-slate-50 text-black font-bold transition-all appearance-none" disabled={currentUser.role === 'Sales Person'}>
                            <option value="all">All Sales Persons</option>
                            {salesPersons.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                        </select>
                    </div>

                    <div className="inline-flex bg-slate-100 p-1 rounded-lg w-full md:w-auto">
                        {(['all', 'week', 'month', 'year'] as const).map((range) => (
                            <button key={range} onClick={() => setSelectedDateRange(range)} className={`px-3 py-1.5 text-xs font-extrabold rounded-md transition-all flex-1 md:flex-none ${selectedDateRange === range ? 'bg-white text-indigo-600 shadow-sm' : 'text-black hover:text-indigo-600'}`}>{range === 'all' ? 'All' : range === 'week' ? '1 Wk' : range === 'month' ? '1 Mo' : '1 Yr'}</button>
                        ))}
                    </div>

                    {currentUser.role === 'Admin' && (
                        <button 
                            onClick={handlePurgeOldData}
                            className="bg-rose-500 hover:bg-rose-600 text-white px-3 py-2 rounded-lg text-xs font-black shadow-sm transition-colors flex items-center gap-1"
                            title="Remove all quotations before April 1st, 2026"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.498-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.498-.06l-.3 7.5a.75.75 0 1 0 1.497.06l.3-7.5Z" clipRule="evenodd" />
                            </svg>
                            Purge Old Data
                        </button>
                    )}
                </div>
            </motion.div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                 <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-center items-center hover:shadow-md transition-shadow min-h-[90px]">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-indigo-600 mb-1"><path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM17.25 19.128l-.001.144a2.25 2.25 0 0 1-.233.96 10.088 10.088 0 0 0 5.06-1.01.75.75 0 0 0 .42-.643 4.875 4.875 0 0 0-6.957-4.611 8.586 8.586 0 0 1 1.71 5.157v.003Z" /></svg>
                    <div className="text-2xl font-black text-black mb-0.5">{[...new Set(filteredQuotations.map(q => q.customerId).filter(id => id !== null))].length}</div>
                    <div className="text-[9px] font-black text-black uppercase tracking-wider text-center">Active Customers</div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-2 rounded-xl shadow-sm text-white flex flex-col justify-center items-center hover:shadow-md transition-shadow min-h-[90px]">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white mb-1"><path fillRule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875ZM12.75 12a.75.75 0 0 0-1.5 0v2.25H9a.75.75 0 0 0 0 1.5h2.25V18a.75.75 0 0 0 1.5 0v-2.25H15a.75.75 0 0 0 0-1.5h-2.25V12Z" clipRule="evenodd" /><path d="M14.25 5.25a5.23 5.23 0 0 0-1.279-3.434 9.768 9.768 0 0 1 6.963 6.963A5.23 5.23 0 0 0 16.5 7.5h-1.875a.375.375 0 0 1-.375-.375V5.25Z" /></svg>
                    <div className="text-2xl font-black">{overallStats.total.count}</div>
                    <div className="text-[10px] font-bold">{formatCurrencyCompact(overallStats.total.value)}</div>
                    <div className="text-[9px] font-black uppercase tracking-wider mt-1 text-center">Total Enquiries</div>
                </motion.div>

                {QUOTATION_STATUSES.map((status, i) => {
                    const colors: Record<string, string> = { 'Open': 'border-blue-500 text-blue-600', 'PO received': 'border-green-500 text-green-600', 'Partial PO Received': 'border-teal-500 text-teal-600', 'Lost': 'border-rose-500 text-rose-600', 'Expired': 'border-amber-500 text-amber-600' };
                    return (
                        <motion.div key={status} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + (i * 0.05) }} className={`bg-white p-2 rounded-xl shadow-sm border-l-4 ${colors[status].split(' ')[0]} flex flex-col justify-center items-center hover:shadow-md transition-shadow min-h-[90px]`}>
                            <StatusIcon status={status} className={`w-7 h-7 mb-1 ${colors[status].split(' ')[1]}`} />
                            <div className="text-xl font-black text-black">{overallStats[status].count}</div>
                            <div className="text-[10px] font-bold text-black mt-0.5">{formatCurrencyCompact(overallStats[status].value)}</div>
                            <div className="text-[9px] font-black text-black uppercase tracking-wider mt-1 text-center truncate w-full">{status}</div>
                        </motion.div>
                    )
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 lg:col-span-1">
                    <h3 className="text-xs font-black text-black mb-4 uppercase tracking-wide">Quotation Funnel</h3>
                    <div className="h-48"><canvas ref={funnelChartRef}></canvas></div>
                </div>
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 lg:col-span-1">
                    <h3 className="text-xs font-black text-black mb-4 uppercase tracking-wide">Value Trend</h3>
                    <div className="h-48"><canvas ref={lineChartRef}></canvas></div>
                </div>
                 <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 lg:col-span-1">
                    <h3 className="text-xs font-black text-black mb-4 uppercase tracking-wide">Top 5 Customers</h3>
                    <div className="h-48"><canvas ref={topCustomersChartRef}></canvas></div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Latest 10 Offers */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-black text-black uppercase tracking-wide">Latest 10 Offers</h3>
                        <span className="text-[10px] text-slate-400 font-bold">Recent Activity</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[10px]">
                            <thead className="bg-slate-50 text-slate-500 uppercase">
                                <tr>
                                    <th className="px-2 py-2 font-black border-b">ID</th>
                                    <th className="px-2 py-2 font-black border-b">Customer</th>
                                    <th className="px-2 py-2 font-black border-b">Date</th>
                                    <th className="px-2 py-2 font-black border-b text-right">Value</th>
                                    <th className="px-2 py-2 font-black border-b text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {[...filteredQuotations].sort((a, b) => b.id - a.id).slice(0, 10).map(q => (
                                    <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-2 py-2 font-bold text-indigo-600">#{q.id}</td>
                                        <td className="px-2 py-2 font-medium truncate max-w-[120px]">{customerMap.get(q.customerId || 0) || 'N/A'}</td>
                                        <td className="px-2 py-2 text-slate-500">{new Date(q.quotationDate).toLocaleDateString('en-GB')}</td>
                                        <td className="px-2 py-2 text-right font-bold">{formatCurrencyCompact(calculateTotalAmount(q.details))}</td>
                                        <td className="px-2 py-2 text-center">
                                            <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase ${
                                                q.status === 'PO received' ? 'bg-green-100 text-green-700' :
                                                q.status === 'Lost' ? 'bg-rose-100 text-rose-700' :
                                                'bg-blue-100 text-blue-700'
                                            }`}>
                                                {q.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Group-wise Status Report */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-black text-black uppercase tracking-wide">Sales Performance Summary</h3>
                        <div className="flex bg-slate-100 p-0.5 rounded-lg">
                            <button onClick={() => setReportMode('count')} className={`px-2 py-1 text-[9px] font-black rounded-md transition-all ${reportMode === 'count' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Count</button>
                            <button onClick={() => setReportMode('value')} className={`px-2 py-1 text-[9px] font-black rounded-md transition-all ${reportMode === 'value' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Value</button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[10px]">
                            <thead className="bg-slate-50 text-slate-500 uppercase">
                                <tr>
                                    <th className="px-2 py-2 font-black border-b">Sales Person</th>
                                    {QUOTATION_STATUSES.map(status => (
                                        <th key={status} className="px-2 py-2 font-black border-b text-center">{status}</th>
                                    ))}
                                    <th className="px-2 py-2 font-black border-b text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {salesPersonStats.map(sp => (
                                    <tr key={sp.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-2 py-2 font-bold">{sp.name}</td>
                                        {QUOTATION_STATUSES.map(status => (
                                            <td key={status} className="px-2 py-2 text-center font-medium">
                                                {reportMode === 'count' ? sp[status].count : formatCurrencyCompact(sp[status].value)}
                                            </td>
                                        ))}
                                        <td className="px-2 py-2 text-right font-black text-indigo-600">
                                            {reportMode === 'count' ? sp.total.count : formatCurrencyCompact(sp.total.value)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
