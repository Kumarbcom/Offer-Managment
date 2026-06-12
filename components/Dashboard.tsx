
import React, { useEffect, useRef, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Quotation, SalesPerson, QuotationStatus, User } from '../types';
import { QUOTATION_STATUSES } from '../constants';
import { getCustomersByIds } from '../supabase';
import { generateFormattedQuotationNumber, getFinancialYear } from '../utils/quotationNumber';

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
    if (isNaN(val) || val === 0) return '0'; // Return simple 0 for cleaner look in table when 0
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
    return `₹${Math.round(val)}`;
}

// Enhanced Icon Helper Component
const StatusIcon = ({ status, className }: { status: string, className?: string }) => {
    switch (status) {
        case 'Open': // Blue - Document with flow
            return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z" /></svg>;
        case 'PO received': // Green - Success check
            return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" /></svg>;
        case 'Partial PO Received': // Teal - Pie chart
            return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path fillRule="evenodd" d="M2.25 13.5a8.25 8.25 0 0 1 8.25-8.25.75.75 0 0 1 .75.75v6.75H18a.75.75 0 0 1 .75.75 8.25 8.25 0 0 1-16.5 0Z" clipRule="evenodd" /><path fillRule="evenodd" d="M12.75 3a.75.75 0 0 1 .75-.75 8.25 8.25 0 0 1 8.25 8.25.75.75 0 0 1-.75.75h-7.5a.75.75 0 0 1-.75-.75V3Z" clipRule="evenodd" /></svg>;
        case 'Lost': // Red - Archive box x mark
            return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M3.375 3C2.339 3 1.5 3.84 1.5 4.875v.75c0 1.036.84 1.875 1.875 1.875h17.25c1.035 0 1.875-.84 1.875-1.875v-.75C22.5 3.839 21.66 3 20.625 3H3.375Z" /><path fillRule="evenodd" d="M3.087 9l.54 9.176A3 3 0 0 0 6.62 21h10.757a3 3 0 0 0 2.995-2.824L20.913 9H3.087Zm6.133 2.845a.75.75 0 0 1 1.06 0l1.72 1.72 1.72-1.72a.75.75 0 1 1 1.06 1.06l-1.72 1.72 1.72 1.72a.75.75 0 1 1-1.06-1.06L12 15.685l-1.72 1.72a.75.75 0 1 1-1.06-1.06l1.72-1.72-1.72-1.72a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>;
        case 'Expired': // Amber - Clock alert
            return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" /></svg>;
        case 'Under Review': // Indigo - Search icon
            return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" /></svg>;
        case 'Need Amendment': // Violet - Pencil icon
            return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32L19.513 8.199Z" /></svg>;
        default:
            return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" /></svg>;
    }
}

export const Dashboard: React.FC<DashboardProps> = ({ quotations, salesPersons, currentUser, onLogoUpload, logoUrl }) => {

    const lineChartRef = useRef<HTMLCanvasElement>(null);
    const barChartRef = useRef<HTMLCanvasElement>(null);
    const funnelChartRef = useRef<HTMLCanvasElement>(null);
    const statusPieChartRef = useRef<HTMLCanvasElement>(null);
    const topCustomersChartRef = useRef<HTMLCanvasElement>(null);

    const [selectedSalesPersonId, setSelectedSalesPersonId] = useState<number | 'all'>('all');
    const [selectedDateRange, setSelectedDateRange] = useState<'all' | 'week' | 'month' | 'year'>('all');
    const [quotationSortType, setQuotationSortType] = useState<'latest' | 'highestValue'>('latest');
    const [barChartMode, setBarChartMode] = useState<'count' | 'value'>('count');
    const [orderStatusMode, setOrderStatusMode] = useState<'count' | 'value'>('value');
    const [performanceMode, setPerformanceMode] = useState<'count' | 'value'>('count'); // New state for Performance Table
    const [customerMap, setCustomerMap] = useState<Map<number, string>>(new Map());

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

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    onLogoUpload(ev.target.result as string);
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

    // Filter quotations based on slicers
    const filteredQuotations = useMemo(() => {
        if (!quotations) return [];
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today

        let startDate: Date | null = null;
        if (selectedDateRange === 'week') {
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 7);
        } else if (selectedDateRange === 'month') {
            startDate = new Date(today);
            startDate.setMonth(today.getMonth() - 1);
        } else if (selectedDateRange === 'year') {
            startDate = new Date(today);
            startDate.setFullYear(today.getFullYear() - 1);
        }

        if (startDate) {
            startDate.setHours(0, 0, 0, 0); // Start of the day
        }
        
        // Determine if current user is restricted
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
                    // Should not happen if data is correct, but fail safe
                    salesPersonMatch = false;
                }
            } else {
                 // Admin / Manager logic
                 salesPersonMatch = selectedSalesPersonId === 'all' || q.salesPersonId === selectedSalesPersonId;
            }
            
            if (!salesPersonMatch) return false;

            if (selectedDateRange === 'all' || !startDate) {
                return true;
            }

            const quotationDate = new Date(q.quotationDate);
            quotationDate.setHours(0, 0, 0, 0);
            return quotationDate >= startDate && quotationDate <= today;
        });
    }, [quotations, selectedSalesPersonId, selectedDateRange, currentUser, salesPersons]);

    const uniqueCustomerCount = useMemo(() => {
        if (!filteredQuotations) return 0;
        const customerIds = new Set(filteredQuotations.map(q => q.customerId).filter(id => id !== null));
        return customerIds.size;
    }, [filteredQuotations]);

    const latestQuotationNo = useMemo(() => {
        if (!filteredQuotations || filteredQuotations.length === 0) return '0000';
        const maxId = Math.max(...filteredQuotations.map(q => q.id));
        const latestQ = filteredQuotations.find(q => q.id === maxId);
        if (!latestQ) return '0000';
        
        const fyInfo = getFinancialYear(latestQ.quotationDate);
        const offsets: Record<string, number> = { '2026-27': 2362, '2025-26': 0 };
        const offset = offsets[fyInfo.fyString] || 0;
        const seq = latestQ.id - offset;
        return seq > 0 ? String(seq).padStart(4, '0') : String(filteredQuotations.length).padStart(4, '0');
    }, [filteredQuotations]);

    // Statistics Calculations using filtered data
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

    const displayedEnquiryCount = useMemo(() => {
        const latestSequence = Number(latestQuotationNo);
        const isUnfilteredAllView =
            selectedDateRange === 'all' &&
            selectedSalesPersonId === 'all' &&
            currentUser.role !== 'Sales Person';

        if (isUnfilteredAllView && !Number.isNaN(latestSequence) && latestSequence > overallStats.total.count) {
            return latestSequence;
        }

        return overallStats.total.count;
    }, [latestQuotationNo, overallStats.total.count, selectedDateRange, selectedSalesPersonId, currentUser.role]);


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

            return {
                id: sp.id,
                name: sp.name,
                ...personStats,
            };
        });
    }, [filteredQuotations, salesPersons]);

    const performanceTotals = useMemo(() => {
        const totals = {
            total: { count: 0, value: 0 },
            'Open': { count: 0, value: 0 },
            'PO received': { count: 0, value: 0 },
            'Partial PO Received': { count: 0, value: 0 },
            'Lost': { count: 0, value: 0 },
            'Expired': { count: 0, value: 0 },
            'Under Review': { count: 0, value: 0 },
            'Need Amendment': { count: 0, value: 0 },
        };

        salesPersonStats.forEach(stat => {
            totals.total.count += stat.total.count;
            totals.total.value += stat.total.value;
            
            QUOTATION_STATUSES.forEach(status => {
                if (totals[status] && stat[status]) {
                    totals[status].count += stat[status].count;
                    totals[status].value += stat[status].value;
                }
            });
        });
        return totals;
    }, [salesPersonStats]);

    const recentQuotations = useMemo(() => {
        let sortedQuotations = [...filteredQuotations];

        if (quotationSortType === 'latest') {
            sortedQuotations.sort((a, b) => {
                const dateDiff = new Date(b.quotationDate).getTime() - new Date(a.quotationDate).getTime();
                if (dateDiff !== 0) return dateDiff;
                return b.id - a.id;
            });
        } else { // 'highestValue'
            sortedQuotations.sort((a, b) => {
                const valueA = calculateTotalAmount(a.details);
                const valueB = calculateTotalAmount(b.details);
                return valueB - valueA;
            });
        }

        return sortedQuotations.slice(0, 5);
    }, [filteredQuotations, quotationSortType]);

    // --- Charts Effects ---

    // 1. Line Chart (Vibrant Gradient)
    useEffect(() => {
        if (!lineChartRef.current || typeof Chart === 'undefined') return;

        const dataByDate = filteredQuotations.reduce((acc, q) => {
            if (!q.quotationDate) return acc;
            const d = new Date(q.quotationDate);
            if (isNaN(d.getTime())) return acc;
            
            const dateStr = q.quotationDate; // Keep the original string for sorting if it's YYYY-MM-DD
            acc[dateStr] = (acc[dateStr] || 0) + calculateTotalAmount(q.details);
            return acc;
        }, {} as Record<string, number>);

        const sortedDates = Object.keys(dataByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        const compactLabels = sortedDates.map(dateStr => {
            // Split YYYY-MM-DD to avoid timezone shifts
            const [y, m, d] = dateStr.split('-').map(Number);
            const date = new Date(y, m - 1, d);
            const day = d.toString().padStart(2, '0');
            const month = date.toLocaleString('default', { month: 'short' });
            return `${day}-${month}`;
        });
        const chartData = sortedDates.map(date => dataByDate[date]);

        const ctx = lineChartRef.current.getContext('2d');
        const chartInstance = new Chart(ctx, {
            type: 'line',
            plugins: [typeof ChartDataLabels !== 'undefined' ? ChartDataLabels : {}],
            data: {
                labels: compactLabels,
                datasets: [{
                    label: 'Quotation Value',
                    data: chartData,
                    borderColor: '#6366f1', // Indigo 500
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#4f46e5',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 25, right: 15, left: 5 } },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        align: 'top',
                        anchor: 'end',
                        color: '#4338ca', // Indigo 800
                        font: { size: 11, weight: 'bold' },
                        formatter: (value: number) => formatCurrencyCompact(value),
                        offset: 4
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        callbacks: { label: (c: any) => `Value: ${formatCurrency(c.parsed.y)}` }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#334155', font: { size: 11, weight: 'bold' } },
                        grid: { display: false }
                    },
                    y: {
                        ticks: { color: '#64748b', font: { size: 10 }, callback: (val: number) => formatCurrencyCompact(val) },
                        border: { display: false },
                        grid: { color: '#f1f5f9' }
                    }
                }
            }
        });
        return () => chartInstance.destroy();
    }, [filteredQuotations]);

    // 2. Bar Chart (Vibrant Colors)
    useEffect(() => {
        if (!barChartRef.current || !salesPersons || typeof Chart === 'undefined') return;

        const vibrantColors: Record<string, string> = {
            'Ananthapadmanabha Phandari': '#8b5cf6', // Violet
            'Giridhar': '#ec4899', // Pink
            'Office': '#f43f5e', // Rose
            'Veeresh': '#10b981', // Emerald
        };

        const dailyData = filteredQuotations.reduce((acc, q) => {
            if (!q.quotationDate) return acc;
            const d = new Date(q.quotationDate);
            if (isNaN(d.getTime())) return acc;

            const dateStr = q.quotationDate;
            const spName = salesPersons.find(sp => sp.id === q.salesPersonId)?.name || 'Unknown';
            if (!acc[dateStr]) acc[dateStr] = {};
            const valueToAdd = barChartMode === 'count' ? 1 : calculateTotalAmount(q.details);
            acc[dateStr][spName] = (acc[dateStr][spName] || 0) + valueToAdd;
            return acc;
        }, {} as Record<string, Record<string, number>>);

        const sortedDates = Object.keys(dailyData).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        const compactLabels = sortedDates.map(dateStr => {
            const [y, m, d] = dateStr.split('-').map(Number);
            const date = new Date(y, m - 1, d);
            const day = d.toString().padStart(2, '0');
            const month = date.toLocaleString('default', { month: 'short' });
            return `${day}-${month}`;
        });

        const datasets = salesPersons.map(sp => ({
            label: sp.name,
            data: sortedDates.map(date => dailyData[date][sp.name] || 0),
            backgroundColor: vibrantColors[sp.name] || '#cbd5e1',
            borderRadius: 4,
            barPercentage: 0.7
        }));

        const ctx = barChartRef.current.getContext('2d');
        const chartInstance = new Chart(ctx, {
            type: 'bar',
            plugins: [typeof ChartDataLabels !== 'undefined' ? ChartDataLabels : {}],
            data: { labels: compactLabels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 20 } },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        display: (context: any) => {
                            const val = Number(context.dataset.data[context.dataIndex]);
                            return !isNaN(val) && val > 0;
                        },
                        color: '#fff',
                        font: { size: 10, weight: 'bold' },
                        formatter: (value: number) => barChartMode === 'value' ? formatCurrencyCompact(value) : value,
                        textShadowBlur: 2,
                        textShadowColor: 'rgba(0,0,0,0.3)'
                    },
                    tooltip: { backgroundColor: '#1e293b', bodyFont: { size: 12 } }
                },
                scales: {
                    x: { stacked: true, ticks: { color: '#334155', font: { size: 11, weight: 'bold' } }, grid: { display: false } },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: { color: '#64748b', font: { size: 10 }, callback: (value: any) => barChartMode === 'value' ? formatCurrencyCompact(Number(value)) : (Number.isInteger(value) ? value : null) },
                        grid: { color: '#f1f5f9' },
                        border: { display: false }
                    }
                }
            }
        });
        return () => chartInstance.destroy();
    }, [filteredQuotations, salesPersons, barChartMode]);

    // 3. Funnel Chart (Vibrant)
    useEffect(() => {
        if (!funnelChartRef.current || typeof Chart === 'undefined') return;

        const funnelStatuses: QuotationStatus[] = ['Open', 'PO received', 'Partial PO Received', 'Expired', 'Lost'];
        const funnelCounts = funnelStatuses
            .map(status => ({ status, count: overallStats[status].count }))
            .filter(item => item.count > 0)
            .sort((a, b) => b.count - a.count);

        const funnelLabels = funnelCounts.map(item => item.status);
        const funnelData = funnelCounts.map(item => item.count);
        const maxDataValue = funnelData.length > 0 ? funnelData[0] : 0;
        const spacerData = funnelData.map(value => (maxDataValue - value) / 2);

        const colorMap: Record<QuotationStatus, string> = {
            'Open': '#3b82f6', // Blue 500
            'PO received': '#22c55e', // Green 500
            'Partial PO Received': '#14b8a6', // Teal 500
            'Expired': '#f59e0b', // Amber 500
            'Lost': '#ef4444', // Red 500
            'Under Review': '#6366f1', // Indigo 500
            'Need Amendment': '#a855f7', // Purple 500
        };
        const funnelColors = funnelCounts.map(item => colorMap[item.status]);

        const ctx = funnelChartRef.current.getContext('2d');
        const chartInstance = new Chart(ctx, {
            type: 'bar',
            plugins: [typeof ChartDataLabels !== 'undefined' ? ChartDataLabels : {}],
            data: {
                labels: funnelLabels,
                datasets: [
                    { data: spacerData, backgroundColor: 'transparent', stack: 'funnel', datalabels: { display: false } },
                    {
                        data: funnelData,
                        backgroundColor: funnelColors,
                        stack: 'funnel',
                        borderRadius: 6,
                        datalabels: {
                            color: '#fff',
                            anchor: 'center',
                            align: 'center',
                            font: { weight: 'bold', size: 12 },
                            display: true,
                            textShadowBlur: 4,
                            textShadowColor: 'rgba(0,0,0,0.5)'
                        }
                    },
                    { data: spacerData, backgroundColor: 'transparent', stack: 'funnel', datalabels: { display: false } }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: { x: { stacked: true, display: false }, y: { stacked: true, display: false } }
            }
        });
        return () => chartInstance.destroy();
    }, [overallStats]);

    // 4. Donut Chart (Vibrant)
    useEffect(() => {
        if (!statusPieChartRef.current || typeof Chart === 'undefined') return;

        const statusData = QUOTATION_STATUSES.map(status => overallStats[status][orderStatusMode]);
        const ctx = statusPieChartRef.current.getContext('2d');
        const chartInstance = new Chart(ctx, {
            type: 'doughnut',
            plugins: [typeof ChartDataLabels !== 'undefined' ? ChartDataLabels : {}],
            data: {
                labels: QUOTATION_STATUSES,
                datasets: [{
                    data: statusData,
                    backgroundColor: ['#3b82f6', '#22c55e', '#14b8a6', '#f59e0b', '#ef4444'],
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11, weight: 'bold' }, color: '#1e293b', padding: 10 } },
                    datalabels: {
                        display: (ctx: any) => {
                            const val = Number(ctx.dataset.data[ctx.dataIndex]);
                            return !isNaN(val) && val > 0;
                        },
                        color: '#fff', // White for better contrast on vibrant colors
                        font: { weight: 'bold', size: 11 },
                        formatter: (value: number) => orderStatusMode === 'value' ? formatCurrencyCompact(value) : value,
                        textShadowBlur: 3,
                        textShadowColor: 'rgba(0,0,0,0.5)'
                    },
                    tooltip: { backgroundColor: '#1e293b' }
                }
            }
        });
        return () => chartInstance.destroy();
    }, [overallStats, orderStatusMode]);

    // 5. Top Customers (Vibrant Bar)
    useEffect(() => {
        if (!topCustomersChartRef.current || typeof Chart === 'undefined') return;

        const customerValues = new Map<string, number>();
        filteredQuotations.forEach(q => {
            const customerName = q.customerId ? customerMap.get(q.customerId) || 'Unknown' : 'Unknown';
            customerValues.set(customerName, (customerValues.get(customerName) || 0) + calculateTotalAmount(q.details));
        });

        const sortedCustomers = [...customerValues.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
        const ctx = topCustomersChartRef.current.getContext('2d');
        const chartInstance = new Chart(ctx, {
            type: 'bar',
            plugins: [typeof ChartDataLabels !== 'undefined' ? ChartDataLabels : {}],
            data: {
                labels: sortedCustomers.map(c => c[0]),
                datasets: [{
                    label: 'Total Value',
                    data: sortedCustomers.map(c => c[1]),
                    backgroundColor: '#d946ef', // Fuchsia 500
                    borderRadius: 4,
                    barThickness: 20
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { right: 45 } },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        anchor: 'end',
                        align: 'right',
                        formatter: (value: number) => formatCurrencyCompact(value),
                        color: '#a21caf', // Fuchsia 700
                        font: { weight: 'bold', size: 11 },
                        offset: 4
                    },
                    tooltip: { backgroundColor: '#1e293b' }
                },
                scales: { x: { display: false }, y: { grid: { display: false }, ticks: { color: '#334155', font: { size: 11, weight: '600' }, autoSkip: false } } }
            }
        });
        return () => chartInstance.destroy();
    }, [filteredQuotations, customerMap]);


    const dateRanges: { key: 'all' | 'week' | 'month' | 'year'; label: string }[] = [
        { key: 'all', label: 'All' },
        { key: 'week', label: '1 Wk' },
        { key: 'month', label: '1 Mo' },
        { key: 'year', label: '1 Yr' },
    ];

    const getCellValue = (data: { count: number, value: number }) => {
        return performanceMode === 'count' ? data.count : formatCurrencyCompact(data.value);
    };

    if (!quotations || !salesPersons) {
        return (
            <div className="flex items-center justify-center h-64 gap-3">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-sm text-slate-500 font-medium">Loading dashboard...</p>
            </div>
        );
    }

    const statusConfig: Record<string, { bg: string; text: string; border: string; badge: string }> = {
        'Open':               { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-400',   badge: 'bg-blue-500' },
        'PO received':        { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-400',  badge: 'bg-green-500' },
        'Partial PO Received':{ bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-400',   badge: 'bg-teal-500' },
        'Lost':               { bg: 'bg-rose-50',   text: 'text-rose-700',   border: 'border-rose-400',   badge: 'bg-rose-500' },
        'Expired':            { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-400',  badge: 'bg-amber-500' },
        'Under Review':       { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-400', badge: 'bg-indigo-500' },
        'Need Amendment':     { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-400', badge: 'bg-purple-500' },
    };

    return (
        <div className="space-y-4 p-2 md:p-4">

            {/* ── Header Bar ── */}
            <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 rounded-2xl px-5 py-4 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
            >
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-500/20 border border-indigo-400/30 p-2.5 rounded-xl">
                        <svg className="w-5 h-5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white tracking-tight leading-none">Dashboard</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Quotation analytics &amp; overview</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
                    {/* Sales Person Filter */}
                    <div className="relative">
                        <select
                            id="salesPersonSlicer"
                            aria-label="Filter by Sales Person"
                            value={selectedSalesPersonId}
                            onChange={(e) => setSelectedSalesPersonId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                            className="pl-3 pr-8 py-2 text-sm rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 appearance-none disabled:opacity-50 min-w-[160px]"
                            disabled={currentUser.role === 'Sales Person'}
                        >
                            <option value="all" className="text-slate-900">All Sales Persons</option>
                            {salesPersons.map(sp => (
                                <option key={sp.id} value={sp.id} className="text-slate-900">{sp.name}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                            <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>

                    {/* Date Range Tabs */}
                    <div className="inline-flex bg-white/10 border border-white/20 p-1 rounded-xl gap-0.5">
                        {([{ key: 'all', label: 'All' }, { key: 'week', label: '1 Wk' }, { key: 'month', label: '1 Mo' }, { key: 'year', label: '1 Yr' }] as const).map(r => (
                            <button
                                key={r.key}
                                onClick={() => setSelectedDateRange(r.key)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${selectedDateRange === r.key ? 'bg-indigo-500 text-white shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                            >{r.label}</button>
                        ))}
                    </div>

                    {/* Logo Upload */}
                    {currentUser.role === 'Admin' && (
                        <div className="flex items-center gap-1">
                            <input type="file" id="logo-upload" accept="image/*" className="hidden" onChange={handleLogoChange} />
                            <label htmlFor="logo-upload" className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white/10 border border-white/20 text-white/80 hover:bg-white/20 cursor-pointer transition-all">
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                {logoUrl ? 'Change Logo' : 'Logo'}
                            </label>
                            {logoUrl && (
                                <button onClick={() => { if (window.confirm('Remove logo?')) onLogoUpload(null); }} className="p-2 rounded-xl bg-white/10 border border-white/20 text-rose-300 hover:bg-rose-500/20 transition-all" title="Remove Logo">
                                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-9 gap-2.5">

                {/* Total Enquiries */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                    className="xl:col-span-1 col-span-1 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-3 shadow-md text-white flex flex-col gap-1 relative overflow-hidden"
                >
                    <div className="absolute -top-3 -right-3 w-16 h-16 bg-white/10 rounded-full" />
                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">Enquiries</div>
                    <div className="text-3xl font-extrabold leading-none">{displayedEnquiryCount}</div>
                    <div className="text-[10px] opacity-70">Latest #{latestQuotationNo}</div>
                    <div className="text-xs font-semibold mt-0.5 opacity-90">{formatCurrencyCompact(overallStats.total.value)}</div>
                </motion.div>

                {/* Customers */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
                    className="xl:col-span-1 col-span-1 bg-white rounded-2xl p-3 shadow-sm border border-slate-100 flex flex-col gap-1 relative overflow-hidden"
                >
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Customers</div>
                    <div className="text-3xl font-extrabold text-slate-800 leading-none">{uniqueCustomerCount}</div>
                    <div className="text-[10px] text-slate-400 mt-auto">Unique</div>
                </motion.div>

                {/* Per-status cards */}
                {QUOTATION_STATUSES.map((status, i) => {
                    const cfg = statusConfig[status] || { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-300', badge: 'bg-slate-400' };
                    const shortLabel: Record<string, string> = {
                        'Open': 'Open', 'PO received': 'PO Rcvd', 'Partial PO Received': 'Partial PO',
                        'Lost': 'Lost', 'Expired': 'Expired', 'Under Review': 'Review', 'Need Amendment': 'Amend'
                    };
                    return (
                        <motion.div
                            key={status}
                            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.04 }}
                            className={`xl:col-span-1 col-span-1 ${cfg.bg} rounded-2xl p-3 shadow-sm border-l-4 ${cfg.border} flex flex-col gap-1 overflow-hidden`}
                        >
                            <div className={`text-[10px] font-bold uppercase tracking-widest ${cfg.text} opacity-80`}>{shortLabel[status]}</div>
                            <div className={`text-3xl font-extrabold leading-none ${cfg.text}`}>{overallStats[status].count}</div>
                            <div className={`text-[10px] font-semibold ${cfg.text} opacity-70`}>{formatCurrencyCompact(overallStats[status].value)}</div>
                        </motion.div>
                    );
                })}
            </div>

            {/* ── Charts Row 1 ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* Funnel */}
                <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Quotation Funnel</h3>
                    </div>
                    <div className="p-3 h-48"><canvas ref={funnelChartRef} /></div>
                </motion.div>

                {/* Value Trend */}
                <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Value Trend</h3>
                    </div>
                    <div className="p-3 h-48"><canvas ref={lineChartRef} /></div>
                </motion.div>

                {/* Top 5 Customers */}
                <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.45 }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-fuchsia-500" />
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Top 5 Customers</h3>
                    </div>
                    <div className="p-3 h-48"><canvas ref={topCustomersChartRef} /></div>
                </motion.div>
            </div>

            {/* ── Charts Row 2 ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">

                {/* Daily Enquiries */}
                <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-violet-500" />
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Daily Enquiries</h3>
                        </div>
                        <div className="inline-flex bg-slate-100 p-0.5 rounded-lg">
                            <button onClick={() => setBarChartMode('count')} className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${barChartMode === 'count' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Cnt</button>
                            <button onClick={() => setBarChartMode('value')} className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${barChartMode === 'value' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Val</button>
                        </div>
                    </div>
                    <div className="p-3 h-48"><canvas ref={barChartRef} /></div>
                </motion.div>

                {/* Order Status Donut */}
                <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.55 }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Order Status</h3>
                        </div>
                        <div className="inline-flex bg-slate-100 p-0.5 rounded-lg">
                            <button onClick={() => setOrderStatusMode('count')} className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${orderStatusMode === 'count' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>No</button>
                            <button onClick={() => setOrderStatusMode('value')} className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${orderStatusMode === 'value' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Val</button>
                        </div>
                    </div>
                    <div className="p-3 h-48"><canvas ref={statusPieChartRef} /></div>
                </motion.div>

                {/* Performance Table */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-orange-500" />
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Performance</h3>
                        </div>
                        <div className="inline-flex bg-slate-100 p-0.5 rounded-lg">
                            <button onClick={() => setPerformanceMode('count')} className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${performanceMode === 'count' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Cnt</button>
                            <button onClick={() => setPerformanceMode('value')} className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${performanceMode === 'value' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Val</button>
                        </div>
                    </div>
                    <div className="overflow-x-auto flex-grow">
                        <table className="min-w-full">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-3 py-2 text-left text-[9px] font-bold text-slate-500 uppercase tracking-wider">Name</th>
                                    <th className="px-2 py-2 text-center text-[9px] font-bold text-slate-500 uppercase">Tot</th>
                                    <th className="px-2 py-2 text-center text-[9px] font-bold text-blue-500 uppercase">Opn</th>
                                    <th className="px-2 py-2 text-center text-[9px] font-bold text-green-500 uppercase">PO</th>
                                    <th className="px-2 py-2 text-center text-[9px] font-bold text-teal-500 uppercase">Prt</th>
                                    <th className="px-2 py-2 text-center text-[9px] font-bold text-rose-500 uppercase">Lst</th>
                                    <th className="px-2 py-2 text-center text-[9px] font-bold text-amber-500 uppercase">Exp</th>
                                    <th className="px-2 py-2 text-center text-[9px] font-bold text-indigo-500 uppercase">Rev</th>
                                    <th className="px-2 py-2 text-center text-[9px] font-bold text-purple-500 uppercase">Amd</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {salesPersonStats.map(stat => (
                                    <tr key={stat.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="px-3 py-1.5 text-[10px] font-semibold text-slate-700 whitespace-nowrap">{stat.name.split(' ')[0]}</td>
                                        <td className="px-2 py-1.5 text-center"><span className="text-[10px] font-bold text-slate-800">{getCellValue(stat.total)}</span></td>
                                        <td className="px-2 py-1.5 text-center"><span className={`text-[10px] font-medium ${stat['Open'].count > 0 ? 'text-blue-600' : 'text-slate-300'}`}>{getCellValue(stat['Open'])}</span></td>
                                        <td className="px-2 py-1.5 text-center"><span className={`text-[10px] font-medium ${stat['PO received'].count > 0 ? 'text-green-600' : 'text-slate-300'}`}>{getCellValue(stat['PO received'])}</span></td>
                                        <td className="px-2 py-1.5 text-center"><span className={`text-[10px] font-medium ${stat['Partial PO Received'].count > 0 ? 'text-teal-600' : 'text-slate-300'}`}>{getCellValue(stat['Partial PO Received'])}</span></td>
                                        <td className="px-2 py-1.5 text-center"><span className={`text-[10px] font-medium ${stat['Lost'].count > 0 ? 'text-rose-600' : 'text-slate-300'}`}>{getCellValue(stat['Lost'])}</span></td>
                                        <td className="px-2 py-1.5 text-center"><span className={`text-[10px] font-medium ${stat['Expired'].count > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{getCellValue(stat['Expired'])}</span></td>
                                        <td className="px-2 py-1.5 text-center"><span className={`text-[10px] font-medium ${stat['Under Review']?.count > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>{getCellValue(stat['Under Review'])}</span></td>
                                        <td className="px-2 py-1.5 text-center"><span className={`text-[10px] font-medium ${stat['Need Amendment']?.count > 0 ? 'text-purple-600' : 'text-slate-300'}`}>{getCellValue(stat['Need Amendment'])}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
                                    <td className="px-3 py-1.5 text-[9px] font-bold uppercase">Total</td>
                                    <td className="px-2 py-1.5 text-center text-[9px] font-bold">{getCellValue(performanceTotals.total)}</td>
                                    <td className="px-2 py-1.5 text-center text-[9px] text-blue-300">{getCellValue(performanceTotals['Open'])}</td>
                                    <td className="px-2 py-1.5 text-center text-[9px] text-green-300">{getCellValue(performanceTotals['PO received'])}</td>
                                    <td className="px-2 py-1.5 text-center text-[9px] text-teal-300">{getCellValue(performanceTotals['Partial PO Received'])}</td>
                                    <td className="px-2 py-1.5 text-center text-[9px] text-rose-300">{getCellValue(performanceTotals['Lost'])}</td>
                                    <td className="px-2 py-1.5 text-center text-[9px] text-amber-300">{getCellValue(performanceTotals['Expired'])}</td>
                                    <td className="px-2 py-1.5 text-center text-[9px] text-indigo-300">{getCellValue(performanceTotals['Under Review'])}</td>
                                    <td className="px-2 py-1.5 text-center text-[9px] text-purple-300">{getCellValue(performanceTotals['Need Amendment'])}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </motion.div>

                {/* Recent Quotations */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-indigo-500" />
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Recent</h3>
                        </div>
                        <div className="inline-flex bg-slate-100 p-0.5 rounded-lg">
                            <button onClick={() => setQuotationSortType('latest')} className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${quotationSortType === 'latest' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>New</button>
                            <button onClick={() => setQuotationSortType('highestValue')} className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${quotationSortType === 'highestValue' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Top</button>
                        </div>
                    </div>
                    <div className="flex-grow overflow-y-auto">
                        {recentQuotations.length === 0 ? (
                            <div className="flex items-center justify-center h-24 text-slate-400 text-xs">No data</div>
                        ) : (
                            <div className="divide-y divide-slate-50">
                                {recentQuotations.map((q, idx) => (
                                    <div key={q.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/80 transition-colors">
                                        <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{idx + 1}</div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[10px] font-bold text-indigo-600" title={generateFormattedQuotationNumber(q, quotations || [])}>
                                                {generateFormattedQuotationNumber(q, quotations || [])}
                                            </div>
                                            <div className="text-[10px] text-slate-500 truncate">{q.customerId ? customerMap.get(q.customerId) || '—' : '—'}</div>
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-800 whitespace-nowrap">{formatCurrencyCompact(calculateTotalAmount(q.details))}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

