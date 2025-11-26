
import React, { useEffect, useRef, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Quotation, SalesPerson, QuotationStatus, User } from '../types';
import { QUOTATION_STATUSES } from '../constants';
import { getCustomersByIds } from '../supabase';

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
            return quotationDate >= startDate && quotationDate <= today;
        });
    }, [quotations, selectedSalesPersonId, selectedDateRange, currentUser, salesPersons]);

    const uniqueCustomerCount = useMemo(() => {
        if (!filteredQuotations) return 0;
        const customerIds = new Set(filteredQuotations.map(q => q.customerId).filter(id => id !== null));
        return customerIds.size;
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
        };

        salesPersonStats.forEach(stat => {
            totals.total.count += stat.total.count;
            totals.total.value += stat.total.value;
            
            totals['Open'].count += stat['Open'].count;
            totals['Open'].value += stat['Open'].value;

            totals['PO received'].count += stat['PO received'].count;
            totals['PO received'].value += stat['PO received'].value;

            totals['Partial PO Received'].count += stat['Partial PO Received'].count;
            totals['Partial PO Received'].value += stat['Partial PO Received'].value;

            totals['Lost'].count += stat['Lost'].count;
            totals['Lost'].value += stat['Lost'].value;

            totals['Expired'].count += stat['Expired'].count;
            totals['Expired'].value += stat['Expired'].value;
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

    // 1. Line Chart
    useEffect(() => {
        if (!lineChartRef.current || typeof Chart === 'undefined') return;

        const dataByDate = filteredQuotations.reduce((acc, q) => {
            const date = q.quotationDate;
            acc[date] = (acc[date] || 0) + calculateTotalAmount(q.details);
            return acc;
        }, {} as Record<string, number>);

        const sortedDates = Object.keys(dataByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        
        // Create compact labels (DD/MM)
        const compactLabels = sortedDates.map(dateStr => {
            const date = new Date(dateStr);
            return `${date.getDate()}/${date.getMonth() + 1}`;
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
                    borderColor: '#000000', // Black line
                    backgroundColor: 'rgba(0, 0, 0, 0.1)',
                    tension: 0.1,
                    fill: false,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: '#000000'
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
                        color: '#000000', // Black labels
                        font: { size: 11, weight: 'bold' },
                        formatter: (value: number) => formatCurrencyCompact(value),
                        offset: 2
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context: any) {
                                return `Value: ${formatCurrency(context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#000000', font: { size: 11, weight: 'bold' } },
                        grid: { display: false }
                    },
                    y: {
                        ticks: { color: '#000000', font: { size: 10 }, callback: (val: number) => formatCurrencyCompact(val) },
                        border: { dash: [4, 4], color: '#000000' },
                        grid: { color: '#e2e8f0' }
                    }
                }
            }
        });
        return () => chartInstance.destroy();
    }, [filteredQuotations]);

    // 2. Bar Chart
    useEffect(() => {
        if (!barChartRef.current || !salesPersons || typeof Chart === 'undefined') return;

        const salesPersonColorMap: Record<string, string> = {
            'Ananthapadmanabha Phandari': '#4C51BF',
            'Giridhar': '#ED64A6',
            'Office': '#F56565',
            'Veeresh': '#48BB78',
        };

        const dailyData = filteredQuotations.reduce((acc, q) => {
            const date = q.quotationDate;
            const spName = salesPersons.find(sp => sp.id === q.salesPersonId)?.name || 'Unknown';
            if (!acc[date]) acc[date] = {};
            const valueToAdd = barChartMode === 'count' ? 1 : calculateTotalAmount(q.details);
            acc[date][spName] = (acc[date][spName] || 0) + valueToAdd;
            return acc;
        }, {} as Record<string, Record<string, number>>);

        const sortedDates = Object.keys(dailyData).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        // Compact labels for bar chart as well
        const compactLabels = sortedDates.map(dateStr => {
            const date = new Date(dateStr);
            return `${date.getDate()}/${date.getMonth() + 1}`;
        });

        const datasets = salesPersons.map(sp => {
            return {
                label: sp.name,
                data: sortedDates.map(date => dailyData[date][sp.name] || 0),
                backgroundColor: salesPersonColorMap[sp.name] || '#A0AEC0',
            };
        });

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
                        formatter: (value: number) => {
                            if (barChartMode === 'value') return formatCurrencyCompact(value);
                            return value;
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context: any) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    if (barChartMode === 'value') label += formatCurrency(context.parsed.y);
                                    else label += context.parsed.y;
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: { 
                        stacked: true,
                        ticks: { color: '#000000', font: { size: 11, weight: 'bold' } },
                        grid: { display: false }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: {
                            color: '#000000',
                            font: { size: 10 },
                            callback: function (value: any) {
                                if (barChartMode === 'value') return formatCurrencyCompact(Number(value));
                                return Number.isInteger(value) ? value : null;
                            }
                        },
                        grid: { color: '#e2e8f0' }
                    }
                }
            }
        });
        return () => chartInstance.destroy();
    }, [filteredQuotations, salesPersons, barChartMode]);

    // 3. Funnel Chart
    useEffect(() => {
        if (!funnelChartRef.current || typeof Chart === 'undefined') return;

        const funnelStatuses: QuotationStatus[] = ['Open', 'PO received', 'Partial PO Received', 'Expired', 'Lost'];
        const funnelCounts = funnelStatuses
            .map(status => ({
                status,
                count: overallStats[status].count
            }))
            .filter(item => item.count > 0)
            .sort((a, b) => b.count - a.count);

        const funnelLabels = funnelCounts.map(item => `${item.status}`);
        const funnelData = funnelCounts.map(item => item.count);
        const maxDataValue = funnelData.length > 0 ? funnelData[0] : 0;

        const spacerData = funnelData.map(value => (maxDataValue - value) / 2);

        const colorMap: Record<QuotationStatus, string> = {
            'Open': '#4299E1',
            'PO received': '#48BB78',
            'Partial PO Received': '#38B2AC',
            'Expired': '#ECC94B',
            'Lost': '#F56565',
        };
        const funnelColors = funnelCounts.map(item => colorMap[item.status]);

        const ctx = funnelChartRef.current.getContext('2d');
        const chartInstance = new Chart(ctx, {
            type: 'bar',
            plugins: [typeof ChartDataLabels !== 'undefined' ? ChartDataLabels : {}],
            data: {
                labels: funnelLabels,
                datasets: [
                    { data: spacerData, backgroundColor: 'rgba(0,0,0,0)', stack: 'funnel', datalabels: { display: false } },
                    {
                        data: funnelData,
                        backgroundColor: funnelColors,
                        stack: 'funnel',
                        datalabels: {
                            color: '#000000', // Changed to black for visibility on colors (or check contrast) - sticking to white on dark bars, but user asked for black. Let's use white for contrast on bars, but black for axis.
                            anchor: 'center',
                            align: 'center',
                            font: { weight: 'bold', size: 12 },
                            display: true,
                            textShadowBlur: 2,
                            textShadowColor: 'rgba(0,0,0,0.3)'
                        }
                    },
                    { data: spacerData, backgroundColor: 'rgba(0,0,0,0)', stack: 'funnel', datalabels: { display: false } }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { filter: (tooltipItem: any) => tooltipItem.datasetIndex === 1 }
                },
                scales: {
                    x: { stacked: true, display: false },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        grid: { display: false },
                        ticks: { color: '#000000', font: { size: 11, weight: 'bold' } }
                    }
                }
            }
        });
        return () => chartInstance.destroy();
    }, [overallStats]);

    // 4. Status Distribution Donut Chart (Order Status)
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
                    backgroundColor: [
                        '#4299E1', // Open - Blue
                        '#48BB78', // PO Received - Green
                        '#38B2AC', // Partial PO - Teal
                        '#F56565', // Lost - Red
                        '#ECC94B'  // Expired - Yellow
                    ],
                    borderWidth: 1,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        position: 'right', 
                        labels: { 
                            boxWidth: 10, 
                            font: { size: 11, weight: 'bold' },
                            color: '#000000' // Black legend
                        } 
                    },
                    datalabels: {
                        display: (ctx: any) => {
                            const val = Number(ctx.dataset.data[ctx.dataIndex]);
                            return !isNaN(val) && val > 0;
                        },
                        color: '#000000', // Black labels on pie
                        font: { weight: 'bold', size: 11 },
                        formatter: (value: number, ctx: any) => {
                            if (orderStatusMode === 'value') return formatCurrencyCompact(value);
                            // For count, show number
                            return value;
                        },
                        anchor: 'end',
                        align: 'start',
                        offset: -10
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context: any) {
                                let label = context.label || '';
                                if (label) label += ': ';
                                if (context.parsed !== null) {
                                    if (orderStatusMode === 'value') label += formatCurrency(context.parsed);
                                    else label += context.parsed;
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
        return () => chartInstance.destroy();
    }, [overallStats, orderStatusMode]);

    // 5. Top Customers Bar Chart
    useEffect(() => {
        if (!topCustomersChartRef.current || typeof Chart === 'undefined') return;

        // Calculate value per customer
        const customerValues = new Map<string, number>();
        filteredQuotations.forEach(q => {
            const customerName = q.customerId ? customerMap.get(q.customerId) || 'Unknown' : 'Unknown';
            const value = calculateTotalAmount(q.details);
            customerValues.set(customerName, (customerValues.get(customerName) || 0) + value);
        });

        const sortedCustomers = [...customerValues.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        const ctx = topCustomersChartRef.current.getContext('2d');
        const chartInstance = new Chart(ctx, {
            type: 'bar',
            plugins: [typeof ChartDataLabels !== 'undefined' ? ChartDataLabels : {}],
            data: {
                labels: sortedCustomers.map(c => c[0]),
                datasets: [{
                    label: 'Total Value',
                    data: sortedCustomers.map(c => c[1]),
                    backgroundColor: '#805AD5', // Purple
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { right: 40 } }, // Add padding for labels
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        anchor: 'end',
                        align: 'right',
                        formatter: (value: number) => formatCurrencyCompact(value),
                        color: '#000000', // Black labels
                        font: { weight: 'bold', size: 11 },
                        offset: 4
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context: any) {
                                return formatCurrency(context.parsed.x);
                            }
                        }
                    }
                },
                scales: {
                    x: { display: false },
                    y: {
                        grid: { display: false },
                        ticks: { color: '#000000', font: { size: 11, weight: '600' }, autoSkip: false }
                    }
                }
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
        return <div className="text-center p-8 text-black">Loading dashboard data...</div>;
    }

    return (
        <div className="space-y-3 p-1 md:p-3">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-100"
            >
                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 p-1.5 rounded-lg shadow-sm">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-black tracking-tight">Dashboard</h2>
                        </div>
                    </div>
                    {/* Logo Upload for Admin - Moved for visibility */}
                     {currentUser.role === 'Admin' && (
                        <div className="relative inline-flex items-center md:hidden">
                            <input type="file" id="logo-upload-mobile" accept="image/*" className="hidden" onChange={handleLogoChange} />
                            <label htmlFor="logo-upload-mobile" className="p-2 bg-slate-50 rounded-full text-indigo-600 border border-slate-200">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </label>
                        </div>
                    )}
                </div>

                {/* Slicer Controls */}
                <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <select
                            id="salesPersonSlicer"
                            aria-label="Filter by Sales Person"
                            value={selectedSalesPersonId}
                            onChange={(e) => setSelectedSalesPersonId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                            className="block w-full pl-4 pr-10 py-2.5 text-sm border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent rounded-lg bg-slate-50 text-black font-medium transition-all hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed appearance-none"
                            disabled={currentUser.role === 'Sales Person'}
                        >
                            <option value="all">All Sales Persons</option>
                            {salesPersons.map(sp => (
                                <option key={sp.id} value={sp.id}>{sp.name}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                            <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>

                    <div className="inline-flex bg-slate-100 p-1 rounded-lg w-full md:w-auto justify-between md:justify-start">
                        {dateRanges.map((range) => (
                            <button
                                key={range.key}
                                type="button"
                                onClick={() => setSelectedDateRange(range.key)}
                                className={`relative inline-flex items-center justify-center flex-1 md:flex-none px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200
                                ${selectedDateRange === range.key
                                        ? 'bg-white text-indigo-600 shadow-sm'
                                        : 'text-black hover:text-indigo-600 hover:bg-slate-200/50'}
                            `}
                            >
                                {range.label}
                            </button>
                        ))}
                    </div>

                     {currentUser.role === 'Admin' && (
                        <div className="relative hidden md:inline-flex items-center">
                            <input type="file" id="logo-upload" accept="image/*" className="hidden" onChange={handleLogoChange} />
                            <label htmlFor="logo-upload" className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-md text-black hover:bg-slate-50 cursor-pointer transition-colors shadow-sm h-full" title="Upload Company Logo">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>{logoUrl ? 'Change Logo' : 'Upload Logo'}</span>
                            </label>
                            {logoUrl && (
                                <button 
                                    onClick={() => { if(window.confirm('Are you sure you want to remove the logo?')) onLogoUpload(null); }}
                                    className="ml-2 text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors"
                                    title="Remove Logo"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Overall Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                 <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-center items-center hover:shadow-md transition-shadow min-h-[90px]"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-indigo-600 mb-1">
                        <path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM17.25 19.128l-.001.144a2.25 2.25 0 0 1-.233.96 10.088 10.088 0 0 0 5.06-1.01.75.75 0 0 0 .42-.643 4.875 4.875 0 0 0-6.957-4.611 8.586 8.586 0 0 1 1.71 5.157v.003Z" />
                    </svg>
                    <div className="text-2xl font-bold text-black mb-0.5">{uniqueCustomerCount}</div>
                    <div className="text-[9px] font-bold text-black uppercase tracking-wider text-center">Active Customers</div>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-2 rounded-xl shadow-sm text-white flex flex-col justify-center items-center hover:shadow-md transition-shadow min-h-[90px]"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white mb-1">
                        <path fillRule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875ZM12.75 12a.75.75 0 0 0-1.5 0v2.25H9a.75.75 0 0 0 0 1.5h2.25V18a.75.75 0 0 0 1.5 0v-2.25H15a.75.75 0 0 0 0-1.5h-2.25V12Z" clipRule="evenodd" />
                        <path d="M14.25 5.25a5.23 5.23 0 0 0-1.279-3.434 9.768 9.768 0 0 1 6.963 6.963A5.23 5.23 0 0 0 16.5 7.5h-1.875a.375.375 0 0 1-.375-.375V5.25Z" />
                    </svg>
                    <div className="text-xl md:text-2xl font-bold">{overallStats.total.count}</div>
                    <div className="text-[10px] font-medium opacity-100">{formatCurrencyCompact(overallStats.total.value)}</div>
                    <div className="text-[9px] font-bold uppercase tracking-wider mt-1 text-center">Total Enquiries</div>
                </motion.div>
                {QUOTATION_STATUSES.map((status, i) => {
                    const colors: Record<string, string> = {
                        'Open': 'border-blue-500 text-blue-600',
                        'PO received': 'border-green-500 text-green-600',
                        'Partial PO Received': 'border-teal-500 text-teal-600',
                        'Lost': 'border-rose-500 text-rose-600',
                        'Expired': 'border-amber-500 text-amber-600'
                    };
                    const iconColor = colors[status].split(' ')[1];
                    return (
                        <motion.div
                            key={status}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 + (i * 0.05) }}
                            className={`bg-white p-2 rounded-xl shadow-sm border-l-4 ${colors[status].split(' ')[0]} flex flex-col justify-center items-center hover:shadow-md transition-shadow min-h-[90px]`}
                        >
                            <StatusIcon status={status} className={`w-7 h-7 mb-1 ${iconColor}`} />
                            <div className="text-lg md:text-xl font-bold text-black">{overallStats[status].count}</div>
                            <div className={`text-[10px] font-semibold text-black mt-0.5`}>{formatCurrencyCompact(overallStats[status].value)}</div>
                            <div className="text-[9px] font-bold text-black uppercase tracking-wider mt-1 text-center truncate w-full">{status}</div>
                        </motion.div>
                    )
                })}
            </div>

            {/* Charts Row 1: Funnel, Value Trend, Top 5 Customers */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white p-3 rounded-xl shadow-sm border border-slate-100"
                >
                    <h3 className="text-xs font-bold text-black mb-4 uppercase tracking-wide">Quotation Funnel</h3>
                    <div className="h-40 md:h-48"><canvas ref={funnelChartRef}></canvas></div>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.45 }}
                    className="bg-white p-3 rounded-xl shadow-sm border border-slate-100"
                >
                    <h3 className="text-xs font-bold text-black mb-4 uppercase tracking-wide">Value Trend</h3>
                    <div className="h-40 md:h-48"><canvas ref={lineChartRef}></canvas></div>
                </motion.div>
                 <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                    className="bg-white p-3 rounded-xl shadow-sm border border-slate-100"
                >
                    <h3 className="text-xs font-bold text-black mb-4 uppercase tracking-wide">Top 5 Customers</h3>
                    <div className="h-40 md:h-48"><canvas ref={topCustomersChartRef}></canvas></div>
                </motion.div>
            </div>

            {/* Row 2: Daily Enquiries, Order Status, Sales Person Stats, Recent Activity */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                {/* 1. Daily Enquiries */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.55 }}
                    className="bg-white p-3 rounded-xl shadow-sm border border-slate-100"
                >
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xs font-bold text-black uppercase tracking-wide">Daily Enquiries</h3>
                        <div className="inline-flex bg-slate-100 p-0.5 rounded-lg">
                            <button type="button" onClick={() => setBarChartMode('count')} className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${barChartMode === 'count' ? 'bg-white text-indigo-600 shadow-sm' : 'text-black hover:text-slate-700'}`}>Cnt</button>
                            <button type="button" onClick={() => setBarChartMode('value')} className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${barChartMode === 'value' ? 'bg-white text-indigo-600 shadow-sm' : 'text-black hover:text-slate-700'}`}>Val</button>
                        </div>
                    </div>
                    <div className="h-40 md:h-48"><canvas ref={barChartRef}></canvas></div>
                </motion.div>

                {/* 2. Order Status */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 }}
                    className="bg-white p-3 rounded-xl shadow-sm border border-slate-100"
                >
                     <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xs font-bold text-black uppercase tracking-wide">Order Status</h3>
                        <div className="inline-flex bg-slate-100 p-0.5 rounded-lg">
                            <button type="button" onClick={() => setOrderStatusMode('count')} className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${orderStatusMode === 'count' ? 'bg-white text-indigo-600 shadow-sm' : 'text-black hover:text-slate-700'}`}>No</button>
                            <button type="button" onClick={() => setOrderStatusMode('value')} className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${orderStatusMode === 'value' ? 'bg-white text-indigo-600 shadow-sm' : 'text-black hover:text-slate-700'}`}>Val</button>
                        </div>
                    </div>
                    <div className="h-40 md:h-48"><canvas ref={statusPieChartRef}></canvas></div>
                </motion.div>

                {/* 3. Compact Sales Person Stats Table */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.65 }}
                    className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col"
                >
                    <div className="p-2 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="text-xs font-bold text-black uppercase tracking-wide">Performance</h3>
                        <div className="inline-flex bg-slate-100 p-0.5 rounded-lg">
                            <button type="button" onClick={() => setPerformanceMode('count')} className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${performanceMode === 'count' ? 'bg-white text-indigo-600 shadow-sm' : 'text-black hover:text-slate-700'}`}>Cnt</button>
                            <button type="button" onClick={() => setPerformanceMode('value')} className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${performanceMode === 'value' ? 'bg-white text-indigo-600 shadow-sm' : 'text-black hover:text-slate-700'}`}>Val</button>
                        </div>
                    </div>
                    <div className="overflow-x-auto flex-grow">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-2 py-2 text-left text-[10px] font-bold text-black uppercase tracking-wider">Name</th>
                                    <th className="px-2 py-2 text-center text-[10px] font-bold text-black uppercase tracking-wider">Tot</th>
                                    <th className="px-2 py-2 text-center text-[10px] font-bold text-black uppercase tracking-wider">Opn</th>
                                    <th className="px-2 py-2 text-center text-[10px] font-bold text-black uppercase tracking-wider">PO</th>
                                    <th className="px-2 py-2 text-center text-[10px] font-bold text-black uppercase tracking-wider">Part</th>
                                    <th className="px-2 py-2 text-center text-[10px] font-bold text-black uppercase tracking-wider">Lst</th>
                                    <th className="px-2 py-2 text-center text-[10px] font-bold text-black uppercase tracking-wider">Exp</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {salesPersonStats.map(stat => (
                                    <tr key={stat.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-2 py-1 whitespace-nowrap text-[10px] font-medium text-black">{stat.name.split(' ')[0]}</td>
                                        <td className="px-2 py-1 whitespace-nowrap text-center bg-slate-50/50">
                                            <div className="font-bold text-black text-[10px]">{getCellValue(stat.total)}</div>
                                        </td>
                                        <td className="px-2 py-1 whitespace-nowrap text-center">
                                            <span className={`text-[10px] font-medium ${stat['Open'].count > 0 ? 'text-black' : 'text-slate-300'}`}>{getCellValue(stat['Open'])}</span>
                                        </td>
                                        <td className="px-2 py-1 whitespace-nowrap text-center">
                                            <span className={`text-[10px] font-medium ${stat['PO received'].count > 0 ? 'text-black' : 'text-slate-300'}`}>{getCellValue(stat['PO received'])}</span>
                                        </td>
                                        <td className="px-2 py-1 whitespace-nowrap text-center">
                                            <span className={`text-[10px] font-medium ${stat['Partial PO Received'].count > 0 ? 'text-black' : 'text-slate-300'}`}>{getCellValue(stat['Partial PO Received'])}</span>
                                        </td>
                                        <td className="px-2 py-1 whitespace-nowrap text-center">
                                            <span className={`text-[10px] font-medium ${stat['Lost'].count > 0 ? 'text-black' : 'text-slate-300'}`}>{getCellValue(stat['Lost'])}</span>
                                        </td>
                                        <td className="px-2 py-1 whitespace-nowrap text-center">
                                            <span className={`text-[10px] font-medium ${stat['Expired'].count > 0 ? 'text-black' : 'text-slate-300'}`}>{getCellValue(stat['Expired'])}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-100 font-bold border-t border-slate-200">
                                <tr>
                                    <td className="px-2 py-1 text-[10px] text-black">TOTAL</td>
                                    <td className="px-2 py-1 text-center text-[10px] text-black">{getCellValue(performanceTotals.total)}</td>
                                    <td className="px-2 py-1 text-center text-[10px] text-black">{getCellValue(performanceTotals['Open'])}</td>
                                    <td className="px-2 py-1 text-center text-[10px] text-black">{getCellValue(performanceTotals['PO received'])}</td>
                                    <td className="px-2 py-1 text-center text-[10px] text-black">{getCellValue(performanceTotals['Partial PO Received'])}</td>
                                    <td className="px-2 py-1 text-center text-[10px] text-black">{getCellValue(performanceTotals['Lost'])}</td>
                                    <td className="px-2 py-1 text-center text-[10px] text-black">{getCellValue(performanceTotals['Expired'])}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </motion.div>

                {/* 4. Recent Quotations Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col"
                >
                    <div className="p-2 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="text-xs font-bold text-black uppercase tracking-wide">Recent</h3>
                        <div className="inline-flex bg-slate-100 p-0.5 rounded-lg">
                            <button type="button" onClick={() => setQuotationSortType('latest')} className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${quotationSortType === 'latest' ? 'bg-white text-indigo-600 shadow-sm' : 'text-black hover:text-slate-700'}`}>New</button>
                            <button type="button" onClick={() => setQuotationSortType('highestValue')} className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${quotationSortType === 'highestValue' ? 'bg-white text-indigo-600 shadow-sm' : 'text-black hover:text-slate-700'}`}>Top</button>
                        </div>
                    </div>
                    <div className="overflow-x-auto flex-grow">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-2 py-2 text-left text-[10px] font-bold text-black uppercase">ID</th>
                                    <th className="px-2 py-2 text-left text-[10px] font-bold text-black uppercase">Cust</th>
                                    <th className="px-2 py-2 text-right text-[10px] font-bold text-black uppercase">Val</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {recentQuotations.map(q => (
                                    <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-2 py-1 whitespace-nowrap">
                                            <div className="text-[10px] font-bold text-indigo-600">#{q.id}</div>
                                        </td>
                                        <td className="px-2 py-1">
                                            <div className="text-[10px] font-semibold text-black truncate max-w-[80px]" title={q.customerId ? customerMap.get(q.customerId) : ''}>{q.customerId ? customerMap.get(q.customerId) || '...' : 'N/A'}</div>
                                        </td>
                                        <td className="px-2 py-1 whitespace-nowrap text-right">
                                            <div className="text-[10px] font-bold text-black">{formatCurrencyCompact(calculateTotalAmount(q.details))}</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {recentQuotations.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-32 text-black">
                                <p className="text-xs">No data</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
};
