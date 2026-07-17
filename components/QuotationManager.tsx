
import React, { useState, useMemo, useEffect } from 'react';
import type { Quotation, SalesPerson, QuotationStatus, User, Customer } from '../types';
import { QUOTATION_STATUSES } from '../constants';
import { generateFormattedQuotationNumber, getQuotationSeqNum } from '../utils/quotationNumber';

declare var XLSX: any;

interface QuotationManagerProps {
  quotations: Quotation[] | null;
  customers: Customer[] | null;
  salesPersons: SalesPerson[] | null;
  setEditingQuotationId: (id: number | null) => void;
  setView: (view: 'quotation-form') => void;
  setQuotations: (value: React.SetStateAction<Quotation[]>) => Promise<void>;
  currentUser: User;
  quotationFilter: { customerIds?: number[], status?: QuotationStatus } | null;
  onBackToCustomers?: () => void;
}

type SortByType = 'id' | 'quotationDate' | 'customer' | 'contactPerson' | 'salesPerson' | 'totalAmount' | 'status';
type SortOrderType = 'asc' | 'desc';

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  'Open':                { label: 'Open',               dot: 'bg-blue-500',   bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  'PO received':         { label: 'PO Received',        dot: 'bg-emerald-500',bg: 'bg-emerald-50',text: 'text-emerald-700',border: 'border-emerald-200' },
  'Partial PO Received': { label: 'Partial PO',         dot: 'bg-teal-500',   bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200' },
  'Expired':             { label: 'Expired',            dot: 'bg-amber-500',  bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  'Lost':                { label: 'Lost',               dot: 'bg-rose-500',   bg: 'bg-rose-50',   text: 'text-rose-700',   border: 'border-rose-200' },
};

const getStatusCfg = (status: string) =>
  STATUS_CONFIG[status] || { label: status, dot: 'bg-slate-400', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };

const StatusBadge: React.FC<{ status: string; onChange?: (s: QuotationStatus) => void }> = ({ status, onChange }) => {
  const cfg = getStatusCfg(status);
  if (onChange) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
        <select
          value={status}
          onChange={e => onChange(e.target.value as QuotationStatus)}
          onClick={e => e.stopPropagation()}
          className={`bg-transparent border-0 p-0 text-[11px] font-semibold focus:outline-none cursor-pointer ${cfg.text} appearance-none`}
          style={{ WebkitAppearance: 'none' }}
        >
          {QUOTATION_STATUSES.map(s => <option key={s} value={s} className="bg-white text-gray-800">{s}</option>)}
        </select>
        <svg className={`w-3 h-3 opacity-60 ${cfg.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </div>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

const getSalesPersonBadgeStyle = (id: number | null, name: string) => {
  const styles = [
    { bg: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500', avatar: 'from-violet-400 to-indigo-500' },
    { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', avatar: 'from-emerald-400 to-teal-500' },
    { bg: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500', avatar: 'from-blue-400 to-indigo-500' },
    { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', avatar: 'from-amber-400 to-orange-500' },
    { bg: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500', avatar: 'from-rose-400 to-pink-500' },
    { bg: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-500', avatar: 'from-teal-400 to-cyan-500' },
    { bg: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200', dot: 'bg-fuchsia-500', avatar: 'from-fuchsia-400 to-pink-500' },
    { bg: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500', avatar: 'from-sky-400 to-indigo-500' }
  ];
  if (!name || name === '—') return { bg: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400', avatar: 'from-slate-400 to-slate-500' };
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % styles.length;
  return styles[index];
};

export const QuotationManager: React.FC<QuotationManagerProps> = ({ quotations, customers, salesPersons, setEditingQuotationId, setView, setQuotations, currentUser, quotationFilter, onBackToCustomers }) => {
  const [universalSearchTerm, setUniversalSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortByType>('quotationDate');
  const [sortOrder, setSortOrder] = useState<SortOrderType>('desc');
  const [selectedQuotationIds, setSelectedQuotationIds] = useState<Set<number>>(new Set());


  const userRole = currentUser.role;

  // Build customer name map synchronously from the prop — no async fetch needed
  const customerMap = useMemo(() => {
    const map = new Map<number, string>();
    if (customers) {
      customers.forEach(c => map.set(c.id, c.name));
    }
    return map;
  }, [customers]);

  const getCustomerName = (id: number | null): string => {
    if (id === null) return '—';
    return customerMap.get(id) || '—';
  };

  const getSalesPersonName = (id: number | null) => salesPersons?.find(sp => sp.id === id)?.name || '—';

  const calculateTotalAmount = (details: Quotation['details'] | undefined): number => {
    if (!details || !Array.isArray(details)) return 0;
    return details.reduce((total, item) => {
      const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
      return total + (unitPrice * item.moq);
    }, 0);
  };

  const handleSort = (newSortBy: SortByType) => {
    setSortBy(newSortBy);
    setSortOrder(prev => sortBy === newSortBy && prev === 'asc' ? 'desc' : 'asc');
  };

  const filteredAndSortedQuotations = useMemo(() => {
    if (!quotations) return [];
    let currentSalesPersonId: number | undefined;
    if (userRole === 'Sales Person') {
      currentSalesPersonId = salesPersons?.find(sp => sp.name === currentUser.name)?.id;
    }
    const preFiltered = quotationFilter
      ? quotations.filter(q => {
          const customerMatch = !quotationFilter.customerIds || (q.customerId !== null && quotationFilter.customerIds.includes(q.customerId));
          const statusMatch = !quotationFilter.status || q.status === quotationFilter.status;
          return customerMatch && statusMatch;
        })
      : quotations;

    return preFiltered
      .filter(q => {
        if (userRole === 'Sales Person' && currentSalesPersonId !== undefined) {
          if (q.salesPersonId !== currentSalesPersonId) return false;
        }
        if (!universalSearchTerm) return true;
        const term = universalSearchTerm.toLowerCase();
        const formattedNo = generateFormattedQuotationNumber(q, quotations || []).toLowerCase();
        const seqNum = getQuotationSeqNum(q, quotations || []).toLowerCase();
        return String(q.id).includes(term)
          || seqNum.includes(term)
          || formattedNo.includes(term)
          || getCustomerName(q.customerId).toLowerCase().includes(term)
          || q.contactPerson.toLowerCase().includes(term)
          || getSalesPersonName(q.salesPersonId).toLowerCase().includes(term)
          || q.status.toLowerCase().includes(term)
          || q.contactNumber.toLowerCase().includes(term);
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'id': comparison = a.id - b.id; break;
          case 'quotationDate': comparison = new Date(a.quotationDate).getTime() - new Date(b.quotationDate).getTime(); break;
          case 'customer': comparison = getCustomerName(a.customerId).localeCompare(getCustomerName(b.customerId)); break;
          case 'contactPerson': comparison = a.contactPerson.localeCompare(b.contactPerson); break;
          case 'salesPerson': comparison = getSalesPersonName(a.salesPersonId).localeCompare(getSalesPersonName(b.salesPersonId)); break;
          case 'totalAmount': comparison = calculateTotalAmount(a.details) - calculateTotalAmount(b.details); break;
          case 'status': comparison = a.status.localeCompare(b.status); break;
        }
        if (comparison === 0 && sortBy !== 'id') {
          return b.id - a.id; // Stable sort fallback to newest IDs first
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [quotations, universalSearchTerm, customerMap, salesPersons, sortBy, sortOrder, quotationFilter, userRole, currentUser]);

  useEffect(() => { setSelectedQuotationIds(new Set()); }, [filteredAndSortedQuotations]);

  const handleAddNew = () => { setEditingQuotationId(null); setView('quotation-form'); };
  const handleEdit = (id: number) => {
    setEditingQuotationId(id);
    const url = new URL(window.location.href);
    url.searchParams.set('id', String(id));
    window.history.pushState({}, '', url);
    setView('quotation-form');
  };
  const handleDelete = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this quotation?")) {
      await setQuotations(prev => (prev || []).filter(q => q.id !== id));
    }
  };
  const handleCommentChange = async (id: number, newComment: string) => {
    try {
      await setQuotations(prev => (prev || []).map(q => q.id === id ? { ...q, comments: newComment } : q));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update comment.');
    }
  };
  const handleStatusChange = async (id: number, newStatus: QuotationStatus) => {
    try {
      await setQuotations(prev => (prev || []).map(q => q.id === id ? { ...q, status: newStatus } : q));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update status.');
    }
  };
  const handleExport = () => {
    if (!filteredAndSortedQuotations || filteredAndSortedQuotations.length === 0) { alert("No data to export."); return; }
    const dataToExport = filteredAndSortedQuotations.flatMap(q => {
      const quotationTotal = calculateTotalAmount(q.details);
      return (q.details || []).map(item => {
        const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
        return {
          'Quotation No': generateFormattedQuotationNumber(q, quotations || []), 'Date': q.quotationDate,
          'Customer': getCustomerName(q.customerId), 'Contact Person': q.contactPerson,
          'Contact No': q.contactNumber, 'Sales Person': getSalesPersonName(q.salesPersonId),
          'Status': q.status, 'Total Amount': quotationTotal, 'Part No': item.partNo,
          'Description': item.description, 'MOQ': item.moq, 'REQ': item.req,
          'Price Source': item.priceSource, 'Base Price': item.price, 'Discount %': item.discount,
          'Unit Price': unitPrice, 'Item Amount': unitPrice * item.moq, 'Stock Status': item.stockStatus,
        };
      });
    });
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Quotations");
    XLSX.writeFile(wb, "Quotations_Export.xlsx");
  };
  const handleWhatsAppShare = (q: Quotation) => {
    const totalValue = calculateTotalAmount(q.details);
    const appUrl = `${window.location.origin}${window.location.pathname}?id=${q.id}`;
    const message = `*Quotation Details*\nQTN No: ${generateFormattedQuotationNumber(q, quotations || [])}\nDate: ${q.quotationDate}\nCustomer: ${getCustomerName(q.customerId)}\nValue: ₹${totalValue.toLocaleString('en-IN')}\nLink: ${appUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };
  const handleSelectOne = (id: number) => {
    setSelectedQuotationIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      return newSet;
    });
  };
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedQuotationIds(new Set(filteredAndSortedQuotations.map(q => q.id)));
    else setSelectedQuotationIds(new Set());
  };
  const handleBulkStatusChange = async (status: QuotationStatus) => {
    if (selectedQuotationIds.size === 0) return;
    if (window.confirm(`Set status to "${status}" for ${selectedQuotationIds.size} item(s)?`)) {
      await setQuotations(prev => (prev || []).map(q => selectedQuotationIds.has(q.id) ? { ...q, status: status } : q));
      setSelectedQuotationIds(new Set());
    }
  };

  const isAllSelected = selectedQuotationIds.size > 0 && selectedQuotationIds.size === filteredAndSortedQuotations.length;
  const canEdit = userRole === 'Admin' || userRole === 'Sales Person';

  // Summary stats
  const stats = useMemo(() => {
    const list = filteredAndSortedQuotations;
    const total = list.reduce((s, q) => s + calculateTotalAmount(q.details), 0);
    const open = list.filter(q => q.status === 'Open').length;
    const won = list.filter(q => q.status === 'PO received' || q.status === 'Partial PO Received').length;
    const lost = list.filter(q => q.status === 'Lost').length;
    return { count: list.length, total, open, won, lost };
  }, [filteredAndSortedQuotations]);

  const SortableHeader: React.FC<{ title: string; sortKey: SortByType; className?: string }> = ({ title, sortKey, className = '' }) => (
    <th
      className={`px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer select-none group ${className}`}
      onClick={() => handleSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        <span className="group-hover:text-indigo-600 transition-colors">{title}</span>
        <span className="text-slate-300 group-hover:text-indigo-400 transition-colors">
          {sortBy === sortKey
            ? (sortOrder === 'asc'
                ? <svg className="w-3 h-3 text-indigo-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
                : <svg className="w-3 h-3 text-indigo-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/></svg>)
            : <svg className="w-3 h-3 opacity-0 group-hover:opacity-50" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
          }
        </span>
      </div>
    </th>
  );

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
  };

  if (quotations === null || salesPersons === null) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Loading quotations...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 font-sans">

      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-20">
        <div className="px-4 md:px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-200">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight">Quotations</h1>
                <p className="text-xs text-slate-500">{stats.count} record{stats.count !== 1 ? 's' : ''} found</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  className="pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 focus:bg-white transition-all w-48 md:w-64"
                  placeholder="Search quotations..."
                  value={universalSearchTerm}
                  onChange={e => setUniversalSearchTerm(e.target.value)}
                />
                {universalSearchTerm && (
                  <button onClick={() => setUniversalSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                  </button>
                )}
              </div>

              {/* Export */}
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
              >
                <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Export
              </button>

              {/* New Quotation */}
              {canEdit && (
                <button
                  onClick={handleAddNew}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg hover:from-indigo-700 hover:to-violet-700 transition-all shadow-sm shadow-indigo-200 active:scale-95"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                  New Quotation
                </button>
              )}

              {onBackToCustomers && (
                <button onClick={onBackToCustomers} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-all">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                  Back
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 py-5 space-y-5">

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Value', value: `₹${(stats.total / 100000).toFixed(1)}L`, sub: stats.count + ' quotations', color: 'from-indigo-500 to-violet-600', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z' },
            { label: 'Open', value: stats.open, sub: 'pending review', color: 'from-blue-500 to-cyan-500', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
            { label: 'Won', value: stats.won, sub: 'PO received', color: 'from-emerald-500 to-teal-500', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
            { label: 'Lost', value: stats.lost, sub: 'closed lost', color: 'from-rose-500 to-pink-500', icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={stat.icon} />
                </svg>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 font-medium">{stat.label}</p>
                <p className="text-xl font-bold text-slate-900 leading-tight">{stat.value}</p>
                <p className="text-[10px] text-slate-400">{stat.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filter / Active Filter Banner ── */}
        {quotationFilter && (
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-xs text-indigo-700">
            <svg className="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
            <span className="font-semibold">Filter active</span>
            <span className="text-indigo-500">— showing filtered results</span>
            {onBackToCustomers && (
              <button onClick={onBackToCustomers} className="ml-auto text-indigo-600 hover:underline font-semibold">Clear &amp; Back</button>
            )}
          </div>
        )}

        {/* ── Bulk Action Bar ── */}
        {selectedQuotationIds.size > 0 && (
          <div className="bg-indigo-600 text-white rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-2 shadow-lg shadow-indigo-200">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
              {selectedQuotationIds.size} selected
            </div>
            <span className="text-indigo-300 text-xs">Set status:</span>
            <div className="flex gap-1 flex-wrap">
              {QUOTATION_STATUSES.map(status => {
                const cfg = getStatusCfg(status);
                return (
                  <button key={status} onClick={() => handleBulkStatusChange(status)}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border} hover:shadow-sm transition-all`}>
                    {status}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setSelectedQuotationIds(new Set())} className="ml-auto text-indigo-200 hover:text-white text-xs">
              Deselect all
            </button>
          </div>
        )}

        {/* ── Mobile Cards ── */}
        <div className="block md:hidden space-y-2">
          {filteredAndSortedQuotations.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">No quotations found</div>
          ) : filteredAndSortedQuotations.map(q => {
            const amount = calculateTotalAmount(q.details);
            const cfg = getStatusCfg(q.status);
            return (
              <div key={q.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className={`h-1 w-full ${cfg.dot}`} />
                <div className="p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <button onClick={() => handleEdit(q.id)} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                        {getQuotationSeqNum(q, quotations || [])}
                      </button>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{getCustomerName(q.customerId)}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(q.quotationDate)} · {getSalesPersonName(q.salesPersonId)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-slate-900">₹{amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                      <StatusBadge status={q.status} onChange={s => handleStatusChange(q.id, s)} />
                    </div>
                  </div>
                  {q.contactPerson && (
                    <div className="text-xs text-slate-600 mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-700">{q.contactPerson}</span>
                      {q.contactNumber && (
                        <span className="inline-flex items-center gap-0.5 text-indigo-600 font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-[10px]">
                          <svg className="w-2.5 h-2.5 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                          </svg>
                          {q.contactNumber}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex justify-end gap-3 border-t border-slate-100 pt-1.5 mt-2">
                    <button onClick={() => handleWhatsAppShare(q)} className="text-emerald-600 text-xs font-medium hover:text-emerald-700">Share</button>
                    <button onClick={() => handleEdit(q.id)} className="text-indigo-600 text-xs font-medium hover:text-indigo-700">Open</button>
                    {userRole === 'Admin' && (
                      <button onClick={() => handleDelete(q.id)} className="text-rose-500 text-xs font-medium hover:text-rose-700">Delete</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Desktop Table ── */}
        <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-3 w-9">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <SortableHeader title="No" sortKey="id" className="w-[60px]" />
                  <SortableHeader title="Date" sortKey="quotationDate" className="w-[88px]" />
                  <SortableHeader title="Customer" sortKey="customer" className="min-w-[180px]" />
                  <SortableHeader title="Contact" sortKey="contactPerson" className="w-[130px]" />
                  <SortableHeader title="Amount" sortKey="totalAmount" className="text-right w-[100px]" />
                  <SortableHeader title="Status" sortKey="status" className="w-[130px]" />
                  <SortableHeader title="Sales Person" sortKey="salesPerson" className="w-[120px]" />
                  <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider min-w-[120px]">Comments</th>
                  <th className="px-3 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider w-[95px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSortedQuotations.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-16">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <svg className="w-10 h-10 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-sm font-medium">No quotations found</p>
                        <p className="text-xs">Try adjusting your search or create a new quotation</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredAndSortedQuotations.map((q, rowIdx) => {
                  const isSelected = selectedQuotationIds.has(q.id);
                  const amount = calculateTotalAmount(q.details);
                  return (
                    <tr
                      key={q.id}
                      className={`group transition-colors ${isSelected ? 'bg-indigo-50/70' : rowIdx % 2 === 0 ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/40 hover:bg-slate-50/80'}`}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-1.5">
                        <input type="checkbox" checked={isSelected} onChange={() => handleSelectOne(q.id)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      </td>

                      {/* No */}
                      <td className="px-3 py-1.5 w-[60px]">
                        <button
                          onClick={() => handleEdit(q.id)}
                          className="font-bold text-indigo-600 hover:text-indigo-800 text-xs transition-colors hover:underline underline-offset-2 whitespace-nowrap"
                          title={generateFormattedQuotationNumber(q, quotations || [])}
                        >
                          {getQuotationSeqNum(q, quotations || [])}
                        </button>
                      </td>

                      {/* Date */}
                      <td className="px-3 py-1.5 text-xs text-slate-600 whitespace-nowrap">
                        {formatDate(q.quotationDate)}
                      </td>

                      {/* Customer */}
                      <td className="px-3 py-1.5 min-w-[180px] max-w-[280px]">
                        <p className="text-xs font-semibold text-slate-800 truncate" title={getCustomerName(q.customerId)}>
                          {getCustomerName(q.customerId)}
                        </p>
                      </td>

                      {/* Contact */}
                      <td className="px-3 py-1.5 w-[130px]">
                        <p className="text-xs font-semibold text-slate-700 truncate" title={q.contactPerson || ''}>{q.contactPerson || '—'}</p>
                        {q.contactNumber && (
                          <p className="text-[10px] text-indigo-600 font-semibold flex items-center gap-1 mt-0.5 whitespace-nowrap">
                            <svg className="w-2.5 h-2.5 flex-shrink-0 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                            </svg>
                            {q.contactNumber}
                          </p>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">
                        <span className="text-xs font-bold text-slate-900">
                          ₹{amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-1.5">
                        <StatusBadge status={q.status} onChange={s => handleStatusChange(q.id, s)} />
                      </td>

                      {/* Sales Person */}
                      <td className="px-3 py-1.5 w-[120px]">
                        {(() => {
                          const spName = getSalesPersonName(q.salesPersonId);
                          const spStyle = getSalesPersonBadgeStyle(q.salesPersonId, spName);
                          return (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${spStyle.bg}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${spStyle.dot}`} />
                              {spName}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Comments */}
                      <td className="px-3 py-1.5 min-w-[120px]">
                        <input
                          type="text"
                          defaultValue={q.comments || ''}
                          onBlur={e => handleCommentChange(q.id, e.target.value)}
                          className="w-full bg-transparent text-[11px] text-slate-600 placeholder-slate-300 border-0 focus:outline-none focus:ring-1 focus:ring-indigo-400 rounded px-1 py-0.5 hover:bg-slate-100 transition-colors"
                          placeholder="Add comment..."
                        />
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-1.5 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          {/* WhatsApp */}
                          <button
                            onClick={() => handleWhatsAppShare(q)}
                            title="Share via WhatsApp"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-colors"
                          >
                            <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                            </svg>
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => handleEdit(q.id)}
                            title="Open Quotation"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>

                          {/* Delete */}
                          {userRole === 'Admin' && (
                            <button
                              onClick={() => handleDelete(q.id)}
                              title="Delete Quotation"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-50 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Table Footer — Grand Total */}
              {filteredAndSortedQuotations.length > 0 && (
                <tfoot>
                  <tr className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
                    <td colSpan={5} className="px-3 py-1.5 text-xs font-semibold text-slate-300">
                      Showing {filteredAndSortedQuotations.length} quotation{filteredAndSortedQuotations.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-3 py-1.5 text-right text-sm font-bold text-white whitespace-nowrap">
                      ₹{stats.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </td>
                    <td colSpan={4} className="px-3 py-1.5 text-xs text-slate-400 text-right">Grand Total</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
