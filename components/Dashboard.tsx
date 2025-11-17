import React, { useEffect, useRef, useMemo, useState } from 'react';
import type { Quotation, Customer, SalesPerson, QuotationStatus, User } from '../types';
import { QUOTATION_STATUSES } from '../constants';
import { getCustomerStats, getCustomersByIds } from '../supabase';

// Forward declaration for Chart.js from CDN
declare const Chart: any;

interface DashboardProps {
  quotations: Quotation[] | null;
  salesPersons: SalesPerson[] | null;
  currentUser: User;
}

const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const Dashboard: React.FC<DashboardProps> = ({ quotations, salesPersons, currentUser }) => {
    
  const lineChartRef = useRef<HTMLCanvasElement>(null);
  const barChartRef = useRef<HTMLCanvasElement>(null);
  const funnelChartRef = useRef<HTMLCanvasElement>(null);
  
  const [selectedSalesPersonId, setSelectedSalesPersonId] = useState<number | 'all'>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<'all' | 'week' | 'month' | 'year'>('all');
  const [quotationSortType, setQuotationSortType] = useState<'latest' | 'highestValue'>('latest');
  const [barChartMode, setBarChartMode] = useState<'count' | 'value'>('count');
  const [customerStats, setCustomerStats] = useState<{ totalCount: number } | null>(null);
  const [customerMap, setCustomerMap] = useState<Map<number, string>>(new Map());
    
  useEffect(() => {
    getCustomerStats().then(setCustomerStats).catch(console.error);
  }, []);

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


  const calculateTotalAmount = (details: Quotation['details']): number => {
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

    // `quotations` prop is already pre-filtered for Sales Person role
    return quotations.filter(q => {
      // Sales person filter from slicer (only if not a sales person user)
      const salesPersonMatch = currentUser.role === 'Sales Person' || selectedSalesPersonId === 'all' || q.salesPersonId === selectedSalesPersonId;
      if (!salesPersonMatch) return false;

      if (selectedDateRange === 'all' || !startDate) {
        return true;
      }

      const quotationDate = new Date(q.quotationDate);
      return quotationDate >= startDate && quotationDate <= today;
    });
  }, [quotations, selectedSalesPersonId, selectedDateRange, currentUser.role]);


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

  const recentQuotations = useMemo(() => {
    let sortedQuotations = [...filteredQuotations];

    if (quotationSortType === 'latest') {
        sortedQuotations.sort((a, b) => new Date(b.quotationDate).getTime() - new Date(a.quotationDate).getTime());
    } else { // 'highestValue'
        sortedQuotations.sort((a, b) => {
            const valueA = calculateTotalAmount(a.details);
            const valueB = calculateTotalAmount(b.details);
            return valueB - valueA;
        });
    }

    return sortedQuotations.slice(0, 5);
  }, [filteredQuotations, quotationSortType]);

  // Line Chart Effect
  useEffect(() => {
    if (!lineChartRef.current || typeof Chart === 'undefined') return;
    
    const dataByDate = filteredQuotations.reduce((acc, q) => {
        const date = q.quotationDate;
        acc[date] = (acc[date] || 0) + calculateTotalAmount(q.details);
        return acc;
    }, {} as Record<string, number>);

    const sortedDates = Object.keys(dataByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const chartData = sortedDates.map(date => dataByDate[date]);
    
    const ctx = lineChartRef.current.getContext('2d');
    const chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [{
                label: 'Quotation Value',
                data: chartData,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1,
                fill: false
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
    return () => chartInstance.destroy();
  }, [filteredQuotations]);
  
  // Bar Chart Effect
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
        data: { labels: sortedDates, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context: any) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                if (barChartMode === 'value') {
                                    label += formatCurrency(context.parsed.y);
                                } else {
                                    label += context.parsed.y;
                                }
                            }
                            return label;
                        }
                    }
                }
            },
            scales: { 
                x: { stacked: true }, 
                y: { 
                    stacked: true, 
                    beginAtZero: true,
                    ticks: {
                        callback: function(value: any) {
                            if (barChartMode === 'value') {
                                if (Number(value) >= 10000000) return `₹${(Number(value) / 10000000).toFixed(2)}Cr`;
                                if (Number(value) >= 100000) return `₹${(Number(value) / 100000).toFixed(2)}L`;
                                if (Number(value) >= 1000) return `₹${(Number(value) / 1000).toFixed(2)}k`;
                                return `₹${value}`;
                            }
                            return Number.isInteger(value) ? value : null;
                        }
                    }
                } 
            }
        }
    });
    return () => chartInstance.destroy();
  }, [filteredQuotations, salesPersons, barChartMode]);

  // Funnel Chart Effect
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

      const funnelLabels = funnelCounts.map(item => `${item.status} (${item.count})`);
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
        data: {
          labels: funnelLabels,
          datasets: [
            { data: spacerData, backgroundColor: 'rgba(0,0,0,0)', stack: 'funnel' },
            { data: funnelData, backgroundColor: funnelColors, stack: 'funnel' },
            { data: spacerData, backgroundColor: 'rgba(0,0,0,0)', stack: 'funnel' }
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
              ticks: { font: { size: 12, weight: 'bold' } }
            }
          }
        }
      });
      return () => chartInstance.destroy();
  }, [overallStats]);

  const dateRanges: { key: 'all' | 'week' | 'month' | 'year'; label: string }[] = [
    { key: 'all', label: 'All Time' },
    { key: 'week', label: 'Last 1 Week' },
    { key: 'month', label: 'Last 1 Month' },
    { key: 'year', label: 'Last 1 Year' },
  ];

  if (!quotations || !salesPersons) {
    return <div className="text-center p-8">Loading dashboard data...</div>;
  }

  return (
    <div className="space-y-3">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">Quotation Dashboard</h2>
            {/* Slicer Controls */}
            <div className="flex flex-wrap gap-4 items-center">
                <select
                    id="salesPersonSlicer"
                    aria-label="Filter by Sales Person"
                    value={selectedSalesPersonId}
                    onChange={(e) => setSelectedSalesPersonId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={currentUser.role === 'Sales Person'}
                >
                    <option value="all">All Sales Persons</option>
                    {salesPersons.map(sp => (
                    <option key={sp.id} value={sp.id}>{sp.name}</option>
                    ))}
                </select>
                <div className="inline-flex rounded-md shadow-sm">
                    {dateRanges.map((range, index) => (
                        <button
                            key={range.key}
                            type="button"
                            onClick={() => setSelectedDateRange(range.key)}
                            className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium transition-colors duration-150
                                ${index === 0 ? 'rounded-l-md' : ''}
                                ${index === dateRanges.length - 1 ? 'rounded-r-md' : '-ml-px'}
                                ${selectedDateRange === range.key ? 'bg-indigo-600 text-white z-10' : 'bg-white text-gray-700 hover:bg-gray-50'}
                                focus:z-20 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500
                            `}
                        >
                            {range.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
        
        {/* Overall Statistics */}
        <div className="bg-white p-2 rounded-lg shadow-md">
          <h3 className="text-base font-bold text-gray-800 mb-1">Overall At a Glance</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1 text-center">
             <div className="bg-purple-100 p-1 rounded-md flex flex-col justify-center">
                <div className="text-xl font-bold text-purple-800">{customerStats?.totalCount ?? '...'}</div>
                <div className="text-[9px] font-semibold text-purple-600 uppercase">Total Customers</div>
            </div>
            <div className="bg-indigo-100 p-1 rounded-md">
              <div className="text-xl font-bold text-indigo-800">{overallStats.total.count}</div>
              <div className="text-[11px] font-bold text-indigo-700">{formatCurrency(overallStats.total.value)}</div>
              <div className="text-[9px] font-semibold text-indigo-600 mt-1 uppercase">Total Enquiries</div>
            </div>
            <div className="bg-blue-100 p-1 rounded-md">
              <div className="text-xl font-bold text-blue-800">{overallStats['Open'].count}</div>
              <div className="text-[11px] font-bold text-blue-700">{formatCurrency(overallStats['Open'].value)}</div>
              <div className="text-[9px] font-semibold text-blue-600 mt-1 uppercase">Open</div>
            </div>
            <div className="bg-green-100 p-1 rounded-md">
              <div className="text-xl font-bold text-green-800">{overallStats['PO received'].count}</div>
              <div className="text-[11px] font-bold text-green-700">{formatCurrency(overallStats['PO received'].value)}</div>
              <div className="text-[9px] font-semibold text-green-600 mt-1 uppercase">PO Received</div>
            </div>
            <div className="bg-teal-100 p-1 rounded-md">
              <div className="text-xl font-bold text-teal-800">{overallStats['Partial PO Received'].count}</div>
              <div className="text-[11px] font-bold text-teal-700">{formatCurrency(overallStats['Partial PO Received'].value)}</div>
              <div className="text-[9px] font-semibold text-teal-600 mt-1 uppercase">Partial PO</div>
            </div>
            <div className="bg-red-100 p-1 rounded-md">
              <div className="text-xl font-bold text-red-800">{overallStats['Lost'].count}</div>
              <div className="text-[11px] font-bold text-red-700">{formatCurrency(overallStats['Lost'].value)}</div>
              <div className="text-[9px] font-semibold text-red-600 mt-1 uppercase">Lost</div>
            </div>
            <div className="bg-yellow-100 p-1 rounded-md">
              <div className="text-xl font-bold text-yellow-800">{overallStats['Expired'].count}</div>
              <div className="text-[11px] font-bold text-yellow-700">{formatCurrency(overallStats['Expired'].value)}</div>
              <div className="text-[9px] font-semibold text-yellow-600 mt-1 uppercase">Expired</div>
            </div>
          </div>
        </div>

        {/* Sales Person Table Section */}
        <div className="bg-white p-2 rounded-lg shadow-md">
            <h3 className="text-base font-bold text-gray-800 mb-2">Statistics by Sales Person</h3>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                    <tr>
                    <th className="px-2 py-1 text-left text-[11px] font-medium text-gray-600 uppercase tracking-wider">Sales Person</th>
                    <th className="px-2 py-1 text-center text-[11px] font-medium text-gray-600 uppercase tracking-wider">Total</th>
                    <th className="px-2 py-1 text-center text-[11px] font-medium text-gray-600 uppercase tracking-wider">Open</th>
                    <th className="px-2 py-1 text-center text-[11px] font-medium text-gray-600 uppercase tracking-wider">PO Received</th>
                    <th className="px-2 py-1 text-center text-[11px] font-medium text-gray-600 uppercase tracking-wider">Partial PO</th>
                    <th className="px-2 py-1 text-center text-[11px] font-medium text-gray-600 uppercase tracking-wider">Lost</th>
                    <th className="px-2 py-1 text-center text-[11px] font-medium text-gray-600 uppercase tracking-wider">Expired</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {salesPersonStats.map(stat => (
                    <tr key={stat.id}>
                        <td className="px-2 py-1 whitespace-nowrap text-xs font-medium text-gray-900">{stat.name}</td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs text-center">
                            <div className="font-semibold text-gray-800">{stat.total.count}</div>
                            <div className="text-[11px] text-gray-500">{formatCurrency(stat.total.value)}</div>
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs text-center">
                            <div className="text-gray-800">{stat['Open'].count}</div>
                            <div className="text-[11px] text-gray-500">{formatCurrency(stat['Open'].value)}</div>
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs text-center">
                            <div className="text-gray-800">{stat['PO received'].count}</div>
                            <div className="text-[11px] text-gray-500">{formatCurrency(stat['PO received'].value)}</div>
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs text-center">
                            <div className="text-gray-800">{stat['Partial PO Received'].count}</div>
                            <div className="text-[11px] text-gray-500">{formatCurrency(stat['Partial PO Received'].value)}</div>
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs text-center">
                            <div className="text-gray-800">{stat['Lost'].count}</div>
                            <div className="text-[11px] text-gray-500">{formatCurrency(stat['Lost'].value)}</div>
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs text-center">
                            <div className="text-gray-800">{stat['Expired'].count}</div>
                            <div className="text-[11px] text-gray-500">{formatCurrency(stat['Expired'].value)}</div>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
        </div>
        
        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="bg-white p-2 rounded-lg shadow-md">
                <h3 className="text-base font-bold text-gray-800 mb-2">Quotation Status Funnel</h3>
                <div className="h-48"><canvas ref={funnelChartRef}></canvas></div>
            </div>
            <div className="bg-white p-2 rounded-lg shadow-md">
                <h3 className="text-base font-bold text-gray-800 mb-2">Quotation Value Over Time</h3>
                <div className="h-48"><canvas ref={lineChartRef}></canvas></div>
            </div>
            <div className="bg-white p-2 rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-base font-bold text-gray-800">Daily Enquiries</h3>
                     <div className="inline-flex rounded-md shadow-sm">
                        <button
                            type="button"
                            onClick={() => setBarChartMode('count')}
                            className={`relative inline-flex items-center px-3 py-1 text-xs font-medium rounded-l-md border border-gray-300
                                ${barChartMode === 'count' ? 'bg-indigo-600 text-white z-10' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                        >
                            By Count
                        </button>
                        <button
                            type="button"
                            onClick={() => setBarChartMode('value')}
                            className={`relative -ml-px inline-flex items-center px-3 py-1 text-xs font-medium rounded-r-md border border-gray-300
                                ${barChartMode === 'value' ? 'bg-indigo-600 text-white z-10' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                        >
                            By Value
                        </button>
                    </div>
                </div>
                <div className="h-48"><canvas ref={barChartRef}></canvas></div>
            </div>
        </div>
        
        {/* Recent Quotations Section */}
        <div className="bg-white p-2 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-base font-bold text-gray-800">Recent Activity</h3>
                <div className="inline-flex rounded-md shadow-sm">
                    <button
                        type="button"
                        onClick={() => setQuotationSortType('latest')}
                        className={`relative inline-flex items-center px-3 py-1 text-xs font-medium rounded-l-md border border-gray-300
                            ${quotationSortType === 'latest' ? 'bg-indigo-600 text-white z-10' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    >
                        Latest 5
                    </button>
                    <button
                        type="button"
                        onClick={() => setQuotationSortType('highestValue')}
                        className={`relative -ml-px inline-flex items-center px-3 py-1 text-xs font-medium rounded-r-md border border-gray-300
                            ${quotationSortType === 'highestValue' ? 'bg-indigo-600 text-white z-10' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    >
                        Top 5 by Value
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-2 py-1 text-left text-[11px] font-medium text-gray-600 uppercase">ID</th>
                            <th className="px-2 py-1 text-left text-[11px] font-medium text-gray-600 uppercase">Date</th>
                            <th className="px-2 py-1 text-left text-[11px] font-medium text-gray-600 uppercase">Customer</th>
                            <th className="px-2 py-1 text-left text-[11px] font-medium text-gray-600 uppercase">Contact</th>
                            <th className="px-2 py-1 text-left text-[11px] font-medium text-gray-600 uppercase">Sales Person</th>
                            <th className="px-2 py-1 text-right text-[11px] font-medium text-gray-600 uppercase">Value</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {recentQuotations.map(q => (
                            <tr key={q.id}>
                                <td className="px-2 py-1 whitespace-nowrap text-xs font-medium text-gray-900">{q.id}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs text-gray-600">{new Date(q.quotationDate).toLocaleDateString()}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs text-gray-800 font-semibold">{q.customerId ? customerMap.get(q.customerId) || '...' : 'N/A'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs text-gray-600">
                                    <div>{q.contactPerson}</div>
                                    <div className="text-[10px] text-gray-500">{q.contactNumber}</div>
                                </td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs text-gray-800">{salesPersons.find(c => c.id === q.salesPersonId)?.name || 'N/A'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs text-gray-800 text-right">{formatCurrency(calculateTotalAmount(q.details))}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {recentQuotations.length === 0 && (
                     <p className="text-center text-gray-500 py-4 text-sm">No quotations to display based on current filters.</p>
                )}
            </div>
        </div>
    </div>
  );
};