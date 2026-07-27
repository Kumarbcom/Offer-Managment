
import React, { useEffect, useRef, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Quotation, SalesPerson, QuotationStatus, User } from '../types';
import { QUOTATION_STATUSES } from '../constants';
import { getCustomersByIds } from '../supabase';
import { generateFormattedQuotationNumber, getFinancialYear } from '../utils/quotationNumber';
import { MonthlyTargets } from './MonthlyTargets';

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
    const customerRadialChartRef = useRef<HTMLCanvasElement>(null);

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

    const customerStats = useMemo(() => {
        if (!filteredQuotations) return { total: 0, repeated: 0, oneTime: 0, newCust: 0 };
        
        const customerQuoteCount = new Map<number, number>();
        const customerFirstQuoteDate = new Map<number, Date>();

        quotations?.forEach(q => {
            if (q.customerId) {
                customerQuoteCount.set(q.customerId, (customerQuoteCount.get(q.customerId) || 0) + 1);
                
                const qDate = new Date(q.quotationDate);
                if (!customerFirstQuoteDate.has(q.customerId) || qDate < customerFirstQuoteDate.get(q.customerId)!) {
                    customerFirstQuoteDate.set(q.customerId, qDate);
                }
            }
        });

        const activeCustomerIds = new Set(filteredQuotations.map(q => q.customerId).filter(id => id !== null) as number[]);
        
        let repeated = 0;
        let oneTime = 0;
        let newCust = 0;
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        activeCustomerIds.forEach(customerId => {
            const count = customerQuoteCount.get(customerId) || 0;
            if (count > 1) {
                repeated++;
            } else if (count === 1) {
                oneTime++;
            }
            
            const firstDate = customerFirstQuoteDate.get(customerId);
            if (firstDate && firstDate >= thirtyDaysAgo) {
                newCust++;
            }
        });

        return {
            total: activeCustomerIds.size,
            repeated,
            oneTime,
            newCust
        };
    }, [filteredQuotations, quotations]);

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

    // 1. Line Chart (Monthly Area Chart)
    useEffect(() => {
        if (!lineChartRef.current || typeof Chart === 'undefined') return;

        const currentYear = new Date().getFullYear();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        const dataByMonth = {
            won: new Array(12).fill(0),
            lost: new Array(12).fill(0),
            open: new Array(12).fill(0),
        };

        filteredQuotations.forEach(q => {
            if (!q.quotationDate) return;
            const d = new Date(q.quotationDate);
            if (isNaN(d.getTime())) return;
            if (d.getFullYear() !== currentYear) return;

            const monthIndex = d.getMonth();
            const amount = calculateTotalAmount(q.details);

            if (q.status === 'PO received' || q.status === 'Partial PO Received') {
                dataByMonth.won[monthIndex] += amount;
            } else if (q.status === 'Lost' || q.status === 'Expired') {
                dataByMonth.lost[monthIndex] += amount;
            } else {
                dataByMonth.open[monthIndex] += amount;
            }
        });

        const ctx = lineChartRef.current.getContext('2d');
        if (!ctx) return;
        
        const gradientWon = ctx.createLinearGradient(0, 0, 0, 400);
        gradientWon.addColorStop(0, 'rgba(99, 102, 241, 0.5)');
        gradientWon.addColorStop(1, 'rgba(99, 102, 241, 0.0)');
        
        const gradientLost = ctx.createLinearGradient(0, 0, 0, 400);
        gradientLost.addColorStop(0, 'rgba(244, 63, 94, 0.5)');
        gradientLost.addColorStop(1, 'rgba(244, 63, 94, 0.0)');
        
        const gradientOpen = ctx.createLinearGradient(0, 0, 0, 400);
        gradientOpen.addColorStop(0, 'rgba(168, 162, 158, 0.3)');
        gradientOpen.addColorStop(1, 'rgba(168, 162, 158, 0.0)');

        const chartInstance = new Chart(ctx, {
            type: 'line',
            plugins: [typeof ChartDataLabels !== 'undefined' ? ChartDataLabels : {}],
            data: {
                labels: monthNames,
                datasets: [
                    {
                        label: 'Won (PO)',
                        data: dataByMonth.won,
                        borderColor: '#6366f1',
                        backgroundColor: gradientWon,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        borderWidth: 2
                    },
                    {
                        label: 'Lost',
                        data: dataByMonth.lost,
                        borderColor: '#f43f5e',
                        backgroundColor: gradientLost,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        borderWidth: 2
                    },
                    {
                        label: 'Open / Pending',
                        data: dataByMonth.open,
                        borderColor: '#a8a29e',
                        backgroundColor: gradientOpen,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 10, right: 15, left: 5 } },
                plugins: {
                    legend: { display: true, position: 'top', align: 'center', labels: { usePointStyle: true, boxWidth: 8, font: { family: "'Inter', sans-serif", weight: '600' } } },
                    datalabels: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#1e293b',
                        callbacks: { label: (c: any) => `${c.dataset.label}: ${formatCurrency(c.parsed.y)}` }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#64748b', font: { size: 11 } },
                        grid: { display: false }
                    },
                    y: {
                        ticks: { color: '#94a3b8', font: { size: 10 }, callback: (val: number) => formatCurrencyCompact(val) },
                        border: { display: false },
                        grid: { color: '#f1f5f9', borderDash: [5, 5] }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
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

    // 5. Customer Radial Chart (Repeated vs One Time vs New)
    useEffect(() => {
        if (!customerRadialChartRef.current || typeof Chart === 'undefined') return;

        const customerStats = new Map<number, { count: number, firstDate: Date }>();
        filteredQuotations.forEach(q => {
            if (q.customerId) {
                const date = new Date(q.quotationDate || Date.now());
                if (!customerStats.has(q.customerId)) {
                    customerStats.set(q.customerId, { count: 1, firstDate: date });
                } else {
                    const stats = customerStats.get(q.customerId)!;
                    stats.count++;
                    if (date < stats.firstDate) stats.firstDate = date;
                }
            }
        });

        let newCustomers = 0;
        let oneTimeCustomers = 0;
        let repeatedCustomers = 0;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        customerStats.forEach(stats => {
            if (stats.firstDate >= thirtyDaysAgo) {
                newCustomers++;
            } else if (stats.count > 1) {
                repeatedCustomers++;
            } else {
                oneTimeCustomers++;
            }
        });

        const totalCustomers = newCustomers + oneTimeCustomers + repeatedCustomers;
        
        // Expose to window for the custom legend to read
        (window as any)._customerRadialStats = {
            total: totalCustomers,
            repeated: repeatedCustomers,
            oneTime: oneTimeCustomers,
            newCust: newCustomers
        };

        const ctx = customerRadialChartRef.current.getContext('2d');
        if (!ctx) return;

        // Custom plugin to draw the "Total" text in the center
        const centerTextPlugin = {
            id: 'centerText',
            beforeDraw: (chart: any) => {
                const { width, height, ctx } = chart;
                ctx.restore();
                const fontSizeTitle = (height / 160).toFixed(2);
                const fontSizeVal = (height / 100).toFixed(2);
                
                ctx.font = `600 ${fontSizeTitle}em Inter, sans-serif`;
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#1e293b';
                
                const textTitle = 'Total';
                const textXTitle = Math.round((width - ctx.measureText(textTitle).width) / 2);
                const textYTitle = height / 2 - 10;
                ctx.fillText(textTitle, textXTitle, textYTitle);

                ctx.font = `800 ${fontSizeVal}em Inter, sans-serif`;
                const textVal = totalCustomers.toString();
                const textXVal = Math.round((width - ctx.measureText(textVal).width) / 2);
                const textYVal = height / 2 + 15;
                ctx.fillText(textVal, textXVal, textYVal);
                ctx.save();
            }
        };

        const chartInstance = new Chart(ctx, {
            type: 'doughnut',
            plugins: [centerTextPlugin],
            data: {
                labels: ['Repeated Customer', 'One Time Customer', 'New Customer'],
                datasets: [
                    {
                        data: [repeatedCustomers, totalCustomers - repeatedCustomers],
                        backgroundColor: ['#6366f1', '#f8fafc'], // Indigo
                        borderWidth: 0,
                        borderRadius: 15,
                        cutout: '85%'
                    },
                    {
                        data: [oneTimeCustomers, totalCustomers - oneTimeCustomers],
                        backgroundColor: ['#f472b6', '#f8fafc'], // Pink
                        borderWidth: 0,
                        borderRadius: 15,
                        cutout: '80%'
                    },
                    {
                        data: [newCustomers, totalCustomers - newCustomers],
                        backgroundColor: ['#fbcfe8', '#f8fafc'], // Light Pink
                        borderWidth: 0,
                        borderRadius: 15,
                        cutout: '75%'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: 10 },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        filter: (item: any) => item.dataIndex === 0, // Only show tooltip for the actual data part, not the empty track
                        callbacks: {
                            label: (context: any) => {
                                const datasetIndex = context.datasetIndex;
                                const labels = ['Repeated', 'One Time', 'New'];
                                return `${labels[datasetIndex]}: ${context.raw}`;
                            }
                        }
                    }
                }
            }
        });
        return () => chartInstance.destroy();
    }, [filteredQuotations]);


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
        <div className="space-y-6 max-w-7xl mx-auto">

            {/* ── Header Area ── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Sales Dashboard</h2>
                </div>

                <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
                    {/* Date Range Selector */}
                    <div className="inline-flex bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
                        {([{ key: 'all', label: 'All' }, { key: 'week', label: '1 Wk' }, { key: 'month', label: '1 Mo' }, { key: 'year', label: '1 Yr' }] as const).map(r => (
                            <button
                                key={r.key}
                                onClick={() => setSelectedDateRange(r.key)}
                                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${selectedDateRange === r.key ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                            >{r.label}</button>
                        ))}
                    </div>

                    {/* Sales Person Filter */}
                    <div className="relative">
                        <select
                            id="salesPersonSlicer"
                            value={selectedSalesPersonId}
                            onChange={(e) => setSelectedSalesPersonId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                            className="pl-4 pr-10 py-2 text-sm font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm appearance-none min-w-[140px]"
                            disabled={currentUser.role === 'Sales Person'}
                        >
                            <option value="all">All Staff</option>
                            {salesPersons.map(sp => (
                                <option key={sp.id} value={sp.id}>{sp.name}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Top Metric Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Total Enquiries */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="bg-white rounded-3xl p-6 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 flex flex-col justify-between h-full">
                    <div className="flex items-start justify-between w-full">
                        <div>
                            <div className="text-sm font-medium text-slate-500 mb-1">Total Enquiries</div>
                            <div className="text-2xl font-extrabold text-slate-800">{displayedEnquiryCount}</div>
                        </div>
                        <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l5.414 5.414a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" /></svg>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100 w-full flex-grow flex flex-col justify-end">
                        <div className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                            Increased by 12%
                        </div>
                    </div>
                </motion.div>

                {/* Customers */}
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}
                    className="bg-white rounded-3xl p-6 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 flex flex-col justify-between h-full">
                    <div className="flex items-start justify-between w-full">
                        <div>
                            <div className="text-sm font-medium text-slate-500 mb-1">Total Customers</div>
                            <div className="text-2xl font-extrabold text-slate-800">{customerStats.total}</div>
                        </div>
                        <div className="w-14 h-14 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-1.5 mt-4 pt-4 border-t border-slate-100 w-full flex-grow justify-end">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 font-medium">Repeated</span>
                            <span className="font-bold text-slate-700 bg-slate-50 px-1.5 rounded">{customerStats.repeated}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 font-medium">1 Time</span>
                            <span className="font-bold text-slate-700 bg-slate-50 px-1.5 rounded">{customerStats.oneTime}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-emerald-600 font-medium">New (30d)</span>
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 rounded border border-emerald-100">{customerStats.newCust}</span>
                        </div>
                    </div>
                </motion.div>

                {/* Total Revenue */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="bg-white rounded-3xl p-6 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 flex flex-col justify-between h-full">
                    <div className="flex items-start justify-between w-full">
                        <div>
                            <div className="text-sm font-medium text-slate-500 mb-1">Total Revenue</div>
                            <div className="text-2xl font-extrabold text-slate-800">{formatCurrencyCompact(overallStats.total.value)}</div>
                        </div>
                        <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-sm shrink-0">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100 w-full flex-grow flex flex-col justify-end">
                        <div className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                            Increased by 1.5%
                        </div>
                    </div>
                </motion.div>

                {/* Won POs */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                    className="bg-white rounded-3xl p-6 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 flex flex-col justify-between h-full">
                    <div className="flex items-start justify-between w-full">
                        <div>
                            <div className="text-sm font-medium text-slate-500 mb-1">Total Sales (PO)</div>
                            <div className="text-2xl font-extrabold text-slate-800">{overallStats['PO received'].count + overallStats['Partial PO Received'].count}</div>
                        </div>
                        <div className="w-14 h-14 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 shadow-sm shrink-0">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100 w-full flex-grow flex flex-col justify-end">
                        <div className="text-xs font-medium text-rose-600 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                            Decreased by 0.1%
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* ── Charts Row 1 ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Sales Overview Line Chart */}
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
                    className="col-span-1 lg:col-span-7 bg-white rounded-3xl shadow-lg shadow-slate-200/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-base font-bold text-slate-800">Sales Overview</h3>
                        <button className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">Sort by <svg className="w-3 h-3 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button>
                    </div>
                    <div className="flex-grow h-48 lg:h-56">
                        <canvas ref={lineChartRef} />
                    </div>
                </motion.div>

                {/* Order Statistics (Donut) & Top Categories */}
                <div className="col-span-1 lg:col-span-5 flex flex-col gap-6">
                    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 }}
                        className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 p-6 flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-base font-bold text-slate-800">Order Statistics</h3>
                            <button className="text-slate-400 hover:text-slate-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg></button>
                        </div>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Total Orders</div>
                                <div className="text-xl font-extrabold text-slate-800">{displayedEnquiryCount}</div>
                            </div>
                            <div className="text-emerald-500 text-[10px] font-bold bg-emerald-50 px-2 py-1 rounded-md">+5.7%</div>
                        </div>
                        <div className="relative flex-grow h-36 flex items-center justify-center">
                            <canvas ref={statusPieChartRef} />
                            <div className="absolute inset-0 flex flex-col items-center justify-center mt-4 pointer-events-none">
                                <div className="text-xs font-bold text-slate-400 uppercase">Total</div>
                                <div className="text-lg font-extrabold text-slate-800">{displayedEnquiryCount}</div>
                            </div>
                        </div>
                        <button className="w-full mt-3 text-xs font-bold text-indigo-600 border border-indigo-100 bg-indigo-50/50 py-2 rounded-xl hover:bg-indigo-50 transition-colors">
                            Complete Statistics &rarr;
                        </button>
                    </motion.div>
                </div>
            </div>

            {/* ✨ Charts Row 2 ✨ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Sales Statistics (Daily Bar) */}
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.45 }}
                    className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 p-6 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-base font-bold text-slate-800">Sales Statistics</h3>
                        <div className="inline-flex bg-slate-50 p-0.5 rounded-lg border border-slate-100">
                            <button onClick={() => setBarChartMode('count')} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${barChartMode === 'count' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Cnt</button>
                            <button onClick={() => setBarChartMode('value')} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${barChartMode === 'value' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Val</button>
                        </div>
                    </div>
                    <div className="flex justify-between items-end mb-2">
                        <div>
                            <div className="text-[10px] text-slate-400 font-semibold mb-0.5">Total Sales</div>
                            <div className="text-lg font-bold text-slate-800">{formatCurrencyCompact(overallStats.total.value)}</div>
                        </div>
                    </div>
                    <div className="flex-grow h-40">
                        <canvas ref={barChartRef} />
                    </div>
                </motion.div>

                {/* Overall Statistics (Funnel) */}
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}
                    className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 p-6 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-base font-bold text-slate-800">Funnel Stats</h3>
                    </div>
                    <div className="flex-grow h-40 flex items-center justify-center">
                        <canvas ref={funnelChartRef} />
                    </div>
                </motion.div>

                {/* Monthly Targets */}
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.55 }}
                    className="flex flex-col h-full">
                    <MonthlyTargets />
                </motion.div>
            </div>

            {/* ── Bottom Section ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-8">
                
                {/* Recent Orders (Latest Quotations) */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                    className="col-span-1 lg:col-span-3 bg-white rounded-3xl shadow-lg shadow-slate-200/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-base font-bold text-slate-800">Recent Quotations</h3>
                        <div className="inline-flex bg-slate-100 p-0.5 rounded-lg">
                            <button onClick={() => setQuotationSortType('latest')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${quotationSortType === 'latest' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Latest</button>
                            <button onClick={() => setQuotationSortType('highestValue')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${quotationSortType === 'highestValue' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>High Value</button>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-separate" style={{ borderSpacing: '0 0.75rem' }}>
                            <thead>
                                <tr>
                                    <th className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b-2 border-transparent">No.</th>
                                    <th className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b-2 border-transparent">Customer</th>
                                    <th className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b-2 border-transparent">Total Amount</th>
                                    <th className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b-2 border-transparent">Status</th>
                                    <th className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b-2 border-transparent">Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentQuotations.map((q) => {
                                    const cfg = statusConfig[q.status] || { bg: 'bg-slate-50', text: 'text-slate-700' };
                                    return (
                                        <tr key={q.id} className="group transition-all hover:shadow-md hover:-translate-y-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.02)] rounded-2xl">
                                            <td className="px-4 py-4 rounded-l-2xl border-y border-l border-slate-100 group-hover:border-transparent">
                                                <div className="font-bold text-indigo-600 text-sm">#{generateFormattedQuotationNumber(q, quotations || [])}</div>
                                            </td>
                                            <td className="px-4 py-4 border-y border-slate-100 group-hover:border-transparent">
                                                <div className="font-bold text-slate-800">{q.customerId ? customerMap.get(q.customerId) || '—' : '—'}</div>
                                            </td>
                                            <td className="px-4 py-4 border-y border-slate-100 group-hover:border-transparent font-bold text-slate-700">
                                                {formatCurrency(calculateTotalAmount(q.details))}
                                            </td>
                                            <td className="px-4 py-4 border-y border-slate-100 group-hover:border-transparent">
                                                <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full ${cfg.bg} ${cfg.text}`}>
                                                    {q.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 rounded-r-2xl border-y border-r border-slate-100 group-hover:border-transparent text-sm font-semibold text-slate-500">
                                                {new Date(q.quotationDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            </div>

        </div>
    );
};

