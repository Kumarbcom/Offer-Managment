import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Quotation, SalesPerson, QuotationStatus, User, Customer } from '../types';
import { QUOTATION_STATUSES } from '../constants';
import { generateFormattedQuotationNumber, getQuotationSeqNum } from '../utils/quotationNumber';
import { calculateTotalAmount } from '../utils/calc';
import { ShareModal } from './ShareModal';
import { ExcelTableColumnFilter, ChecklistOption } from './ExcelTableColumnFilter';
import { customerCache, getCustomersByIds, cacheCustomerLocally, fetchQuotationsBatch, searchQuotationsRemote } from '../supabase';

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
  globalSearch?: string;
  onClearGlobalSearch?: () => void;
}

type SortByType = 'id' | 'quotationDate' | 'customer' | 'contactPerson' | 'salesPerson' | 'totalAmount' | 'status' | 'comments';
type SortOrderType = 'asc' | 'desc';

interface ColumnFilterState {
  qtnNo?: string;
  dateFrom?: string;
  dateTo?: string;
  customers?: string[];
  contactPerson?: string;
  amountMin?: number;
  amountMax?: number;
  statuses?: QuotationStatus[];
  salesPersonIds?: number[];
  comments?: string;
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  'Open':                { label: 'Open',               dot: 'bg-blue-500',   bg: 'bg-[#edf5fe]', text: 'text-[#0b5cff]', border: 'border-blue-200/80' },
  'PO received':         { label: 'Won',                dot: 'bg-emerald-500',bg: 'bg-[#eefcf3]', text: 'text-[#059669]', border: 'border-emerald-200/80' },
  'Partial PO Received': { label: 'Partial PO',         dot: 'bg-teal-500',   bg: 'bg-[#eefcf3]', text: 'text-[#059669]', border: 'border-emerald-200/80' },
  'Expired':             { label: 'Expired',            dot: 'bg-amber-500',  bg: 'bg-[#fff8ea]', text: 'text-[#d97706]', border: 'border-amber-200/80' },
  'Lost':                { label: 'Lost',               dot: 'bg-rose-500',   bg: 'bg-[#fff1f2]', text: 'text-[#e11d48]', border: 'border-rose-200/80' },
  'Under Review':        { label: 'In Review',          dot: 'bg-purple-500', bg: 'bg-[#f4f0ff]', text: 'text-[#7c3aed]', border: 'border-purple-200/80' },
  'Need Amendment':      { label: 'Need Amendment',     dot: 'bg-sky-500',    bg: 'bg-[#f0f9ff]', text: 'text-[#0284c7]', border: 'border-sky-200/80' },
};

const getStatusCfg = (status: string) =>
  STATUS_CONFIG[status] || { label: status, dot: 'bg-slate-400', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };

const StatusBadge: React.FC<{ status: string; onChange?: (s: QuotationStatus) => void }> = ({ status, onChange }) => {
  const cfg = getStatusCfg(status);
  if (onChange) {
    return (
      <div className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full border text-xs font-semibold ${cfg.bg} ${cfg.text} ${cfg.border} shadow-2xs`}>
        <select
          value={status}
          onChange={e => onChange(e.target.value as QuotationStatus)}
          onClick={e => e.stopPropagation()}
          className={`bg-transparent border-0 p-0 text-xs font-semibold focus:outline-none cursor-pointer ${cfg.text} appearance-none`}
          style={{ WebkitAppearance: 'none' }}
        >
          {QUOTATION_STATUSES.map(s => <option key={s} value={s} className="bg-white text-gray-800">{s}</option>)}
        </select>
        <svg className={`w-3 h-3 ml-1 opacity-60 ${cfg.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </div>
    );
  }
  return (
    <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full border text-xs font-semibold ${cfg.bg} ${cfg.text} ${cfg.border} shadow-2xs`}>
      {cfg.label}
    </span>
  );
};

export const QuotationManager: React.FC<QuotationManagerProps> = ({
  quotations,
  customers,
  salesPersons,
  setEditingQuotationId,
  setView,
  setQuotations,
  currentUser,
  quotationFilter,
  onBackToCustomers,
  globalSearch,
  onClearGlobalSearch,
}) => {
  const [universalSearchTerm, setUniversalSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortByType>('quotationDate');
  const [sortOrder, setSortOrder] = useState<SortOrderType>('desc');
  const [selectedQuotationIds, setSelectedQuotationIds] = useState<Set<number>>(new Set());
  const [emailModalQuotation, setEmailModalQuotation] = useState<Quotation | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // View Mode: 'standard' (Modern clean card/table view as per user mockup) or 'excel' (Spreadsheet table with column filters)
  const [viewMode, setViewMode] = useState<'excel' | 'standard'>('standard');

  // Side Panel state for viewing detailed comments, history and items
  const [selectedSidePanelQuotation, setSelectedSidePanelQuotation] = useState<Quotation | null>(null);
  const [sidePanelComment, setSidePanelComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);

  // On-demand customer cache for quotations whose customer ID is not in initial memory list
  const [extraCustomers, setExtraCustomers] = useState<Map<number, Customer>>(new Map());

  // Cloud Sync Status
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Live');

  const handleSyncOffers = async () => {
    setIsSyncing(true);
    try {
      window.dispatchEvent(new CustomEvent('sync_quotations_requested'));
      await new Promise(r => setTimeout(r, 650));
      setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } finally {
      setIsSyncing(false);
    }
  };

  // State for loading older quotations from cloud
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);

  const handleLoadOlderOffers = async () => {
    if (isLoadingOlder || hasReachedEnd) return;
    setIsLoadingOlder(true);
    try {
      const currentCount = quotations?.length || 0;
      const olderBatch = await fetchQuotationsBatch(currentCount, 100);
      if (olderBatch && olderBatch.length > 0) {
        await setQuotations(prev => {
          const map = new Map<number, Quotation>();
          (prev || []).forEach(item => { if (item && item.id) map.set(item.id, item); });
          olderBatch.forEach(item => { if (item && item.id) map.set(item.id, item); });
          return Array.from(map.values()).sort((a, b) => b.id - a.id);
        });
        if (olderBatch.length < 100) {
          setHasReachedEnd(true);
        }
      } else {
        setHasReachedEnd(true);
      }
    } catch (err) {
      console.error("Failed to load older offers:", err);
    } finally {
      setIsLoadingOlder(false);
    }
  };

  const getCustomerCity = (id: number | null | undefined): string => {
    if (id === null || id === undefined) return '';
    const numId = Number(id);
    const cust = customers?.find(c => c.id === numId) || extraCustomers.get(numId) || customerCache.get(numId);
    if (cust && cust.city) return cust.city;
    if (cust && cust.address) {
      const parts = cust.address.split(',');
      return parts[parts.length - 1]?.trim() || '';
    }
    return '';
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const getValidityDate = (quotationDateStr: string) => {
    if (!quotationDateStr) return '—';
    try {
      const parts = quotationDateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        d.setDate(d.getDate() + 30);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      return '—';
    } catch {
      return '—';
    }
  };

  const formatCurrencyDisplay = (num: number) => {
    if (!num || isNaN(num)) return '₹0';
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(2)}L`;
    if (num >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
    return `₹${Math.round(num).toLocaleString('en-IN')}`;
  };

  const handlePostSidePanelComment = async () => {
    if (!selectedSidePanelQuotation || !sidePanelComment.trim()) return;
    setIsPostingComment(true);
    try {
      const newCommentObj = {
        id: String(Date.now()),
        userName: currentUser.name || 'User',
        text: sidePanelComment.trim(),
        timestamp: new Date().toISOString()
      };
      const updatedCommentsList = [...(selectedSidePanelQuotation.commentsList || []), newCommentObj];
      const updatedCommentsText = sidePanelComment.trim();

      await setQuotations(prev => (prev || []).map(q => 
        q.id === selectedSidePanelQuotation.id 
          ? { ...q, comments: updatedCommentsText, commentsList: updatedCommentsList } 
          : q
      ));

      setSelectedSidePanelQuotation(prev => prev ? { ...prev, comments: updatedCommentsText, commentsList: updatedCommentsList } : null);
      setSidePanelComment('');
    } catch (err) {
      alert('Failed to save comment');
    } finally {
      setIsPostingComment(false);
    }
  };

  // Excel Column Filters State
  const [columnFilters, setColumnFilters] = useState<ColumnFilterState>({});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState<string | null>(null);

  useEffect(() => {
    if (globalSearch) {
      setUniversalSearchTerm(globalSearch);
      if (onClearGlobalSearch) {
        onClearGlobalSearch();
      }
    }
  }, [globalSearch, onClearGlobalSearch]);

  // Debounced remote search on Supabase to automatically retrieve older matching quotations
  useEffect(() => {
    const term = universalSearchTerm.trim();
    if (!term || term.length < 2) return;
    const timer = setTimeout(async () => {
      try {
        const remoteResults = await searchQuotationsRemote(term);
        if (remoteResults && remoteResults.length > 0) {
          await setQuotations(prev => {
            const map = new Map<number, Quotation>();
            (prev || []).forEach(item => { if (item && item.id) map.set(item.id, item); });
            remoteResults.forEach(item => { if (item && item.id) map.set(item.id, item); });
            return Array.from(map.values()).sort((a, b) => b.id - a.id);
          });
        }
      } catch (err) {
        console.warn("Remote quotation search error:", err);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [universalSearchTerm]);

  const userRole = currentUser.role;

  // Build customer name map synchronously from props + on-demand cache + global cache
  const customerMap = useMemo(() => {
    const map = new Map<number | string, string>();
    if (customers && Array.isArray(customers)) {
      customers.forEach(c => {
        if (c && c.name) {
          if (c.id !== undefined && c.id !== null) {
            map.set(c.id, c.name);
            map.set(Number(c.id), c.name);
            map.set(String(c.id), c.name);
          }
        }
      });
    }
    // Include on-demand fetched customers
    extraCustomers.forEach((c, id) => {
      if (c && c.name) {
        map.set(id, c.name);
        map.set(Number(id), c.name);
        map.set(String(id), c.name);
      }
    });
    // Include global cache
    customerCache.forEach((c, id) => {
      if (c && c.name) {
        map.set(id, c.name);
        map.set(Number(id), c.name);
        map.set(String(id), c.name);
      }
    });
    return map;
  }, [customers, extraCustomers]);

  // Eagerly resolve customer details for any quotations whose customer is missing from in-memory props
  useEffect(() => {
    if (!quotations || quotations.length === 0) return;
    const missingIds = new Set<number>();
    quotations.forEach(q => {
      if (q.customerId && typeof q.customerId === 'number' && q.customerId > 0) {
        const numId = Number(q.customerId);
        const hasIt = (customers && customers.some(c => c.id === numId)) || extraCustomers.has(numId) || customerCache.has(numId);
        if (!hasIt) {
          missingIds.add(numId);
        }
      }
    });

    if (missingIds.size > 0) {
      getCustomersByIds(Array.from(missingIds)).then(fetched => {
        if (fetched && fetched.length > 0) {
          setExtraCustomers(prev => {
            const next = new Map(prev);
            fetched.forEach(c => {
              if (c && c.id) {
                next.set(Number(c.id), c);
                cacheCustomerLocally(c);
              }
            });
            return next;
          });
        }
      }).catch(err => {
        console.warn("Could not fetch missing customers for quotations:", err);
      });
    }
  }, [quotations, customers, extraCustomers]);

  const getCustomerName = (id: number | null | undefined, quotation?: Quotation): string => {
    if (quotation) {
      const embeddedName = (quotation as any).customerName || (quotation as any).customer_name;
      if (embeddedName && typeof embeddedName === 'string' && embeddedName.trim()) {
        return embeddedName.trim();
      }
    }
    if (id === null || id === undefined || id === 0) return '—';
    const numId = Number(id);
    return customerMap.get(id) || customerMap.get(numId) || customerMap.get(String(id)) || extraCustomers.get(numId)?.name || customerCache.get(numId)?.name || '—';
  };

  const getSalesPersonName = (id: number | null) => salesPersons?.find(sp => sp.id === id)?.name || '—';


  const handleSort = (newSortBy: SortByType, forcedOrder?: SortOrderType) => {
    setSortBy(newSortBy);
    if (forcedOrder) {
      setSortOrder(forcedOrder);
    } else {
      setSortOrder(prev => sortBy === newSortBy && prev === 'asc' ? 'desc' : 'asc');
    }
  };

  // Distinct checklist options for Excel column filters
  const distinctCustomers: ChecklistOption[] = useMemo(() => {
    if (!quotations) return [];
    const counts = new Map<string, number>();
    quotations.forEach(q => {
      const name = getCustomerName(q.customerId);
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ label: name, value: name, count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [quotations, customerMap]);

  const distinctStatuses: ChecklistOption[] = useMemo(() => {
    if (!quotations) return [];
    const counts = new Map<string, number>();
    quotations.forEach(q => {
      counts.set(q.status, (counts.get(q.status) || 0) + 1);
    });
    return QUOTATION_STATUSES.map(s => ({
      label: s,
      value: s,
      count: counts.get(s) || 0,
    }));
  }, [quotations]);

  const distinctSalesPersons: ChecklistOption[] = useMemo(() => {
    if (!quotations || !salesPersons) return [];
    const counts = new Map<number, number>();
    quotations.forEach(q => {
      if (q.salesPersonId !== null) {
        counts.set(q.salesPersonId, (counts.get(q.salesPersonId) || 0) + 1);
      }
    });
    return salesPersons.map(sp => ({
      label: sp.name,
      value: sp.id,
      count: counts.get(sp.id) || 0,
    }));
  }, [quotations, salesPersons]);

  // Count active column filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (columnFilters.qtnNo) count++;
    if (columnFilters.dateFrom || columnFilters.dateTo) count++;
    if (columnFilters.customers && columnFilters.customers.length > 0) count++;
    if (columnFilters.contactPerson) count++;
    if (columnFilters.amountMin !== undefined || columnFilters.amountMax !== undefined) count++;
    if (columnFilters.statuses && columnFilters.statuses.length > 0) count++;
    if (columnFilters.salesPersonIds && columnFilters.salesPersonIds.length > 0) count++;
    if (columnFilters.comments) count++;
    return count;
  }, [columnFilters]);

  const clearAllFilters = () => {
    setColumnFilters({});
    setUniversalSearchTerm('');
  };

  const clearSingleFilter = (key: keyof ColumnFilterState) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      delete next[key];
      if (key === 'dateFrom' || key === 'dateTo') {
        delete next.dateFrom;
        delete next.dateTo;
      }
      if (key === 'amountMin' || key === 'amountMax') {
        delete next.amountMin;
        delete next.amountMax;
      }
      return next;
    });
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
        // Sales Person restriction
        if (userRole === 'Sales Person' && currentSalesPersonId !== undefined && !universalSearchTerm) {
          if (q.salesPersonId !== currentSalesPersonId) return false;
        }
        if (userRole === 'Customer' && currentUser.customerId !== undefined) {
          if (q.customerId !== currentUser.customerId) return false;
        }

        // ── Excel Column Filters ──
        if (columnFilters.qtnNo) {
          const term = columnFilters.qtnNo.toLowerCase();
          const seqNum = getQuotationSeqNum(q, quotations || []).toLowerCase();
          const formattedNo = generateFormattedQuotationNumber(q, quotations || []).toLowerCase();
          if (!String(q.id).includes(term) && !seqNum.includes(term) && !formattedNo.includes(term)) {
            return false;
          }
        }

        if (columnFilters.dateFrom && q.quotationDate < columnFilters.dateFrom) {
          return false;
        }
        if (columnFilters.dateTo && q.quotationDate > columnFilters.dateTo) {
          return false;
        }

        if (columnFilters.customers && columnFilters.customers.length > 0) {
          const custName = getCustomerName(q.customerId);
          if (!columnFilters.customers.includes(custName)) {
            return false;
          }
        }

        if (columnFilters.contactPerson) {
          const term = columnFilters.contactPerson.toLowerCase();
          if (!q.contactPerson.toLowerCase().includes(term) && !q.contactNumber.toLowerCase().includes(term)) {
            return false;
          }
        }

        if (columnFilters.amountMin !== undefined || columnFilters.amountMax !== undefined) {
          const amt = calculateTotalAmount(q);
          if (columnFilters.amountMin !== undefined && amt < columnFilters.amountMin) return false;
          if (columnFilters.amountMax !== undefined && amt > columnFilters.amountMax) return false;
        }

        if (columnFilters.statuses && columnFilters.statuses.length > 0) {
          if (!columnFilters.statuses.includes(q.status)) {
            return false;
          }
        }

        if (columnFilters.salesPersonIds && columnFilters.salesPersonIds.length > 0) {
          if (q.salesPersonId === null || !columnFilters.salesPersonIds.includes(q.salesPersonId)) {
            return false;
          }
        }

        if (columnFilters.comments) {
          const term = columnFilters.comments.toLowerCase();
          if (!(q.comments || '').toLowerCase().includes(term)) {
            return false;
          }
        }

        // ── Universal Top Search ──
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
          case 'totalAmount': comparison = calculateTotalAmount(a) - calculateTotalAmount(b); break;
          case 'status': comparison = a.status.localeCompare(b.status); break;
          case 'comments': comparison = (a.comments || '').localeCompare(b.comments || ''); break;
        }
        if (comparison === 0 && sortBy !== 'id') {
          return b.id - a.id; // Stable sort fallback to newest IDs first
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [quotations, universalSearchTerm, columnFilters, customerMap, salesPersons, sortBy, sortOrder, quotationFilter, userRole, currentUser]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedQuotationIds(new Set());
  }, [universalSearchTerm, columnFilters, sortBy, sortOrder, quotationFilter]);

  const totalItems = filteredAndSortedQuotations.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / (pageSize || 50)));

  const paginatedQuotations = useMemo(() => {
    if (pageSize === 0) return filteredAndSortedQuotations;
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedQuotations.slice(start, start + pageSize);
  }, [filteredAndSortedQuotations, currentPage, pageSize]);

  // Selected totals & Excel status bar stats
  const selectedStats = useMemo(() => {
    const list = filteredAndSortedQuotations;
    const selectedList = list.filter(q => selectedQuotationIds.has(q.id));
    const targetList = selectedList.length > 0 ? selectedList : list;
    const sum = targetList.reduce((acc, q) => acc + calculateTotalAmount(q), 0);
    const avg = targetList.length > 0 ? sum / targetList.length : 0;
    return {
      selectedCount: selectedList.length,
      sum,
      avg,
      hasSelection: selectedList.length > 0,
    };
  }, [filteredAndSortedQuotations, selectedQuotationIds]);

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
  const handleExport = async () => {
    if (!filteredAndSortedQuotations || filteredAndSortedQuotations.length === 0) { alert("No data to export."); return; }

    try {
      const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
          import('exceljs'),
          import('file-saver'),
      ]);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Quotations Report');

      worksheet.columns = [
        { header: 'Quotation No', key: 'qtnNo', width: 20 },
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Customer Name', key: 'customer', width: 30 },
        { header: 'Part No', key: 'partNo', width: 20 },
        { header: 'MOQ', key: 'moq', width: 10 },
        { header: 'REQ', key: 'req', width: 10 },
        { header: 'Price Source', key: 'priceSource', width: 12 },
        { header: 'LP / SP', key: 'lpsp', width: 12 },
        { header: 'Discount', key: 'discount', width: 12 },
        { header: 'Unit Price', key: 'unitPrice', width: 14 },
        { header: 'Amount', key: 'amount', width: 16 },
        { header: 'Stock Status', key: 'stockStatus', width: 16 },
        { header: 'Air Freight/Mtr', key: 'airFreightUnit', width: 14 },
        { header: 'Air Freight Total', key: 'airFreightAmount', width: 16 },
        { header: 'Air Lead Time', key: 'airLeadTime', width: 14 },
        { header: 'Sales Person', key: 'salesPerson', width: 18 },
        { header: 'Created By', key: 'createdBy', width: 16 },
        { header: 'Status', key: 'status', width: 14 }
      ];

      worksheet.getRow(1).font = { name: 'Cambria', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      const airFreightRate = 180;
      let rowCount = 2;

      filteredAndSortedQuotations.forEach(q => {
        (q.details || []).forEach(item => {
          const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
          const freightPerMtr = item.airFreightDetails?.weightPerMtr ? (item.airFreightDetails.weightPerMtr / 1000 * airFreightRate) : 0; 
          const freightTotal = item.airFreight ? freightPerMtr * (item.moq || 0) : 0;

          const row = worksheet.addRow({
            qtnNo: generateFormattedQuotationNumber(q, quotations || []),
            date: q.quotationDate,
            customer: getCustomerName(q.customerId),
            partNo: item.partNo || '',
            moq: item.moq,
            req: item.req,
            priceSource: item.priceSource || '',
            lpsp: item.price || 0,
            discount: item.discount || 0,
            unitPrice: unitPrice,
            amount: unitPrice * (item.moq || 0),
            stockStatus: item.stockStatus || '',
            airFreightUnit: item.airFreight ? freightPerMtr : 0,
            airFreightAmount: freightTotal,
            airLeadTime: item.airFreightDetails?.airFreightLeadTime || '',
            salesPerson: getSalesPersonName(q.salesPersonId),
            createdBy: q.preparedBy || '',
            status: q.status
          });

          row.font = { name: 'Cambria', size: 10 };
          row.alignment = { vertical: 'middle' };
          row.getCell('lpsp').numFmt = '#,##0.00';
          row.getCell('discount').numFmt = '0.00"%"';
          row.getCell('unitPrice').numFmt = '#,##0.00';
          row.getCell('amount').numFmt = '#,##0.00';
          row.getCell('airFreightUnit').numFmt = '#,##0.00';
          row.getCell('airFreightAmount').numFmt = '#,##0.00';
          rowCount++;
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Quotations_Report_${new Date().toISOString().split('T')[0]}.xlsx`);

    } catch (err) {
      console.error("Export Error:", err);
      alert("Failed to export Excel file. Please try again.");
    }
  };

  const handleSelectOne = (id: number) => {
    setSelectedQuotationIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      return newSet;
    });
  };
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedQuotationIds(new Set(paginatedQuotations.map(q => q.id)));
    else setSelectedQuotationIds(new Set());
  };
  const handleBulkStatusChange = async (status: QuotationStatus) => {
    if (selectedQuotationIds.size === 0) return;
    if (window.confirm(`Set status to "${status}" for ${selectedQuotationIds.size} item(s)?`)) {
      await setQuotations(prev => (prev || []).map(q => selectedQuotationIds.has(q.id) ? { ...q, status: status } : q));
      setSelectedQuotationIds(new Set());
    }
  };

  const isAllSelected = paginatedQuotations.length > 0 && paginatedQuotations.every(q => selectedQuotationIds.has(q.id));
  const canEdit = userRole === 'Admin' || userRole === 'Sales Person';

  // Status Breakdown calculation for KPI Cards Row
  const statusBreakdown = useMemo(() => {
    let list = quotations || [];
    if (userRole === 'Sales Person') {
      const currentSalesPersonId = salesPersons?.find(sp => sp.name === currentUser.name)?.id;
      if (currentSalesPersonId !== undefined) {
        list = list.filter(q => q.salesPersonId === currentSalesPersonId);
      }
    }
    if (quotationFilter?.customerIds && quotationFilter.customerIds.length > 0) {
      list = list.filter(q => q.customerId !== null && quotationFilter.customerIds?.includes(q.customerId));
    }

    const counts = {
      total: { count: 0, amount: 0 },
      open: { count: 0, amount: 0 },
      poReceived: { count: 0, amount: 0 },
      invoiced: { count: 0, amount: 0 },
      lost: { count: 0, amount: 0 },
      amendment: { count: 0, amount: 0 },
    };

    list.forEach(q => {
      const amt = calculateTotalAmount(q);
      counts.total.count += 1;
      counts.total.amount += amt;

      const st = q.status;
      if (st === 'Open') {
        counts.open.count += 1;
        counts.open.amount += amt;
      } else if (st === 'PO received') {
        counts.poReceived.count += 1;
        counts.poReceived.amount += amt;
      } else if (st === 'Partial PO Received') {
        counts.invoiced.count += 1;
        counts.invoiced.amount += amt;
      } else if (st === 'Lost' || st === 'Expired') {
        counts.lost.count += 1;
        counts.lost.amount += amt;
      } else if (st === 'Need Amendment' || st === 'Under Review') {
        counts.amendment.count += 1;
        counts.amendment.amount += amt;
      }
    });

    return counts;
  }, [quotations, userRole, currentUser, salesPersons, quotationFilter]);

  const handleStatusCardClick = (category: 'all' | 'Open' | 'PO received' | 'Partial PO Received' | 'Lost' | 'Need Amendment') => {
    if (category === 'all') {
      setColumnFilters(prev => {
        const next = { ...prev };
        delete next.statuses;
        return next;
      });
      return;
    }

    let targetStatuses: QuotationStatus[] = [];
    if (category === 'Open') targetStatuses = ['Open'];
    else if (category === 'PO received') targetStatuses = ['PO received'];
    else if (category === 'Partial PO Received') targetStatuses = ['Partial PO Received'];
    else if (category === 'Lost') targetStatuses = ['Lost', 'Expired'];
    else if (category === 'Need Amendment') targetStatuses = ['Need Amendment', 'Under Review'];

    setColumnFilters(prev => {
      const current = prev.statuses || [];
      const isSame = current.length === targetStatuses.length && targetStatuses.every(s => current.includes(s));
      if (isSame) {
        const next = { ...prev };
        delete next.statuses;
        return next;
      }
      return { ...prev, statuses: targetStatuses };
    });
  };

  const isStatusCardActive = (category: 'all' | 'Open' | 'PO received' | 'Partial PO Received' | 'Lost' | 'Need Amendment') => {
    const current = columnFilters.statuses;
    if (category === 'all') {
      return !current || current.length === 0;
    }
    if (!current || current.length === 0) return false;
    if (category === 'Open') return current.length === 1 && current[0] === 'Open';
    if (category === 'PO received') return current.length === 1 && current[0] === 'PO received';
    if (category === 'Partial PO Received') return current.length === 1 && current[0] === 'Partial PO Received';
    if (category === 'Lost') return current.includes('Lost') || current.includes('Expired');
    if (category === 'Need Amendment') return current.includes('Need Amendment') || current.includes('Under Review');
    return false;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
  };

  // Excel Header Cell Component with integrated Sort & Filter Dropdown
  const ExcelHeaderCell: React.FC<{
    title: string;
    columnKey: keyof ColumnFilterState;
    sortKey: SortByType;
    className?: string;
    type: 'text' | 'date' | 'number-range' | 'checklist';
    checklistOptions?: ChecklistOption[];
    sortAscLabel?: string;
    sortDescLabel?: string;
  }> = ({
    title,
    columnKey,
    sortKey,
    className = '',
    type,
    checklistOptions,
    sortAscLabel = 'Sort A to Z',
    sortDescLabel = 'Sort Z to A',
  }) => {
    const isSorted = sortBy === sortKey;
    const isFiltered = Boolean(
      (columnKey === 'qtnNo' && columnFilters.qtnNo) ||
      (columnKey === 'dateFrom' && (columnFilters.dateFrom || columnFilters.dateTo)) ||
      (columnKey === 'customers' && columnFilters.customers && columnFilters.customers.length > 0) ||
      (columnKey === 'contactPerson' && columnFilters.contactPerson) ||
      (columnKey === 'amountMin' && (columnFilters.amountMin !== undefined || columnFilters.amountMax !== undefined)) ||
      (columnKey === 'statuses' && columnFilters.statuses && columnFilters.statuses.length > 0) ||
      (columnKey === 'salesPersonIds' && columnFilters.salesPersonIds && columnFilters.salesPersonIds.length > 0) ||
      (columnKey === 'comments' && columnFilters.comments)
    );

    const isOpen = activeFilterDropdown === columnKey;

    return (
      <th className={`px-2 py-2 text-left text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 relative select-none ${className}`}>
        <div className="flex items-center justify-between gap-1 w-full">
          <span
            className="cursor-pointer hover:text-emerald-700 transition-colors truncate"
            onClick={() => handleSort(sortKey)}
            title={`Sort by ${title}`}
          >
            {title}
          </span>

          <div className="flex items-center gap-0.5 shrink-0">
            {/* Active Sort Indicator */}
            {isSorted && (
              <span className="text-emerald-700 font-extrabold text-[11px]">
                {sortOrder === 'asc' ? '▲' : '▼'}
              </span>
            )}

            {/* Excel Filter Funnel Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveFilterDropdown(isOpen ? null : columnKey);
              }}
              className={`p-1 rounded transition-all cursor-pointer ${
                isFiltered
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'
              }`}
              title={`Filter & Sort ${title}`}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Dropdown Filter Box */}
        {isOpen && (
          <ExcelTableColumnFilter
            columnKey={columnKey}
            columnTitle={title}
            isOpen={isOpen}
            onClose={() => setActiveFilterDropdown(null)}
            onSortAsc={() => handleSort(sortKey, 'asc')}
            onSortDesc={() => handleSort(sortKey, 'desc')}
            currentSortKey={sortKey}
            currentSortOrder={sortOrder}
            sortAscLabel={sortAscLabel}
            sortDescLabel={sortDescLabel}
            type={type}
            textValue={
              columnKey === 'qtnNo' ? columnFilters.qtnNo :
              columnKey === 'contactPerson' ? columnFilters.contactPerson :
              columnKey === 'comments' ? columnFilters.comments : ''
            }
            onTextApply={(val) => {
              setColumnFilters(prev => ({ ...prev, [columnKey]: val || undefined }));
            }}
            dateFrom={columnFilters.dateFrom}
            dateTo={columnFilters.dateTo}
            onDateApply={(from, to) => {
              setColumnFilters(prev => ({ ...prev, dateFrom: from, dateTo: to }));
            }}
            minVal={columnFilters.amountMin}
            maxVal={columnFilters.amountMax}
            onRangeApply={(min, max) => {
              setColumnFilters(prev => ({ ...prev, amountMin: min, amountMax: max }));
            }}
            checklistOptions={checklistOptions}
            selectedChecklistValues={
              columnKey === 'customers' ? (columnFilters.customers || []) :
              columnKey === 'statuses' ? (columnFilters.statuses || []) :
              columnKey === 'salesPersonIds' ? (columnFilters.salesPersonIds || []) : []
            }
            onChecklistApply={(vals) => {
              if (columnKey === 'customers') {
                setColumnFilters(prev => ({ ...prev, customers: vals.length > 0 ? (vals as string[]) : undefined }));
              } else if (columnKey === 'statuses') {
                setColumnFilters(prev => ({ ...prev, statuses: vals.length > 0 ? (vals as QuotationStatus[]) : undefined }));
              } else if (columnKey === 'salesPersonIds') {
                setColumnFilters(prev => ({ ...prev, salesPersonIds: vals.length > 0 ? (vals as number[]) : undefined }));
              }
            }}
            isFiltered={isFiltered}
            onClear={() => clearSingleFilter(columnKey)}
          />
        )}
      </th>
    );
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
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* ── Top Header Toolbar matching user mockup ── */}
      <div className="bg-white border-b border-slate-200/90 shadow-2xs sticky top-0 z-30">
        <div className="px-4 md:px-8 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            
            {/* Title & Subtitle */}
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                Quotations
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Create, manage and track quotations with your customers.
              </p>
            </div>

            {/* Actions & Controls */}
            <div className="flex items-center gap-2.5 flex-wrap">
              
              {/* Search Quotations with right search icon */}
              <div className="relative">
                <input
                  type="text"
                  className="pl-3.5 pr-8 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-48 sm:w-60 shadow-2xs"
                  placeholder="Search quotations..."
                  value={universalSearchTerm}
                  onChange={e => setUniversalSearchTerm(e.target.value)}
                />
                <svg className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {universalSearchTerm && (
                  <button onClick={() => setUniversalSearchTerm('')} className="absolute right-7 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">
                    ✕
                  </button>
                )}
              </div>

              {/* Notification Bell with red dot badge */}
              <button 
                type="button" 
                className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Notifications"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1.5 right-1.5 ring-2 ring-white"></span>
              </button>

              {/* View Switcher: Standard vs Excel */}
              <div className="hidden sm:inline-flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewMode('standard')}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    viewMode === 'standard'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Modern Card Table View"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  <span>Standard</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('excel')}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    viewMode === 'excel'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Spreadsheet Excel grid with sort & filter headers"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 4h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Excel</span>
                </button>
              </div>

              {/* Export to Excel */}
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
                title="Download full quotation details as Excel (.xlsx)"
              >
                <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                <span>Export</span>
              </button>

              {/* New Quotation Button in Royal Blue */}
              {canEdit && (
                <button
                  onClick={handleAddNew}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#0b5cff] hover:bg-[#004ee0] text-white rounded-xl transition-all shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                  <span>New Quotation</span>
                  <svg className="w-3.5 h-3.5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
              )}

              {onBackToCustomers && (
                <button onClick={onBackToCustomers} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all cursor-pointer">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                  <span>Back</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 py-5 space-y-4">

        {/* ── Status-Wise Breakup KPI Cards Row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          
          {/* Card 1: Total Offers (Dark Navy Card) */}
          <div
            onClick={() => handleStatusCardClick('all')}
            className={`p-3.5 rounded-2xl shadow-2xs relative overflow-hidden flex flex-col justify-between cursor-pointer transition-all ${
              isStatusCardActive('all')
                ? 'bg-[#0f233d] text-white ring-2 ring-blue-500 shadow-md scale-[1.01]'
                : 'bg-[#0f233d]/90 text-white/90 hover:bg-[#0f233d] hover:shadow-xs hover:-translate-y-0.5'
            }`}
            title="Click to view all offers"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span>Total Offers</span>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                isStatusCardActive('all') ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                All
              </span>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-black font-mono text-white leading-none">
                {statusBreakdown.total.count.toLocaleString()}
              </div>
              <div className="text-[11px] font-semibold text-blue-300 mt-1.5 flex items-center gap-1 truncate">
                <span className="opacity-80">Value:</span>
                <span className="font-mono font-bold text-white">{formatCurrencyDisplay(statusBreakdown.total.amount)}</span>
              </div>
            </div>
            {/* Background watermark */}
            <div className="absolute right-2 bottom-1 opacity-10 pointer-events-none text-white">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>

          {/* Card 2: Open (Soft Blue Card) */}
          <div
            onClick={() => handleStatusCardClick('Open')}
            className={`p-3.5 rounded-2xl shadow-2xs relative flex flex-col justify-between cursor-pointer transition-all ${
              isStatusCardActive('Open')
                ? 'bg-blue-100 border-2 border-blue-600 shadow-md ring-2 ring-blue-400/40 scale-[1.01]'
                : 'bg-blue-50/85 border border-blue-200/80 hover:bg-blue-100/70 hover:shadow-xs hover:-translate-y-0.5'
            }`}
            title="Click to filter by Open quotations"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-800">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] leading-none">✓</span>
                <span>Open</span>
              </div>
              <div className="w-5 h-5 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-black font-mono text-slate-900 leading-none">
                {statusBreakdown.open.count.toLocaleString()}
              </div>
              <div className="text-[11px] font-semibold text-blue-700 mt-1.5 flex items-center gap-1 truncate">
                <span className="text-slate-500 font-normal">Value:</span>
                <span className="font-mono font-bold">{formatCurrencyDisplay(statusBreakdown.open.amount)}</span>
              </div>
            </div>
          </div>

          {/* Card 3: PO Received (Soft Emerald Card) */}
          <div
            onClick={() => handleStatusCardClick('PO received')}
            className={`p-3.5 rounded-2xl shadow-2xs relative flex flex-col justify-between cursor-pointer transition-all ${
              isStatusCardActive('PO received')
                ? 'bg-emerald-100 border-2 border-emerald-600 shadow-md ring-2 ring-emerald-400/40 scale-[1.01]'
                : 'bg-emerald-50/85 border border-emerald-200/80 hover:bg-emerald-100/70 hover:shadow-xs hover:-translate-y-0.5'
            }`}
            title="Click to filter by PO Received quotations"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800">
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] leading-none">✓</span>
                <span>PO Received</span>
              </div>
              <div className="w-5 h-5 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-black font-mono text-slate-900 leading-none">
                {statusBreakdown.poReceived.count.toLocaleString()}
              </div>
              <div className="text-[11px] font-semibold text-emerald-700 mt-1.5 flex items-center gap-1 truncate">
                <span className="text-slate-500 font-normal">Value:</span>
                <span className="font-mono font-bold">{formatCurrencyDisplay(statusBreakdown.poReceived.amount)}</span>
              </div>
            </div>
          </div>

          {/* Card 4: Invoiced / Partial PO (Soft Amber Card) */}
          <div
            onClick={() => handleStatusCardClick('Partial PO Received')}
            className={`p-3.5 rounded-2xl shadow-2xs relative flex flex-col justify-between cursor-pointer transition-all ${
              isStatusCardActive('Partial PO Received')
                ? 'bg-amber-100 border-2 border-amber-600 shadow-md ring-2 ring-amber-400/40 scale-[1.01]'
                : 'bg-amber-50/85 border border-amber-200/80 hover:bg-amber-100/70 hover:shadow-xs hover:-translate-y-0.5'
            }`}
            title="Click to filter by Partial PO Received"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800">
                <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-mono leading-none">₹</span>
                <span>Invoiced / Part</span>
              </div>
              <div className="w-5 h-5 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <rect width="20" height="14" x="2" y="5" rx="2" />
                  <line x1="2" x2="22" y1="10" y2="10" />
                </svg>
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-black font-mono text-slate-900 leading-none">
                {statusBreakdown.invoiced.count.toLocaleString()}
              </div>
              <div className="text-[11px] font-semibold text-amber-700 mt-1.5 flex items-center gap-1 truncate">
                <span className="text-slate-500 font-normal">Value:</span>
                <span className="font-mono font-bold">{formatCurrencyDisplay(statusBreakdown.invoiced.amount)}</span>
              </div>
            </div>
          </div>

          {/* Card 5: Lost / Expired (Soft Rose Card) */}
          <div
            onClick={() => handleStatusCardClick('Lost')}
            className={`p-3.5 rounded-2xl shadow-2xs relative flex flex-col justify-between cursor-pointer transition-all ${
              isStatusCardActive('Lost')
                ? 'bg-rose-100 border-2 border-rose-600 shadow-md ring-2 ring-rose-400/40 scale-[1.01]'
                : 'bg-rose-50/85 border border-rose-200/80 hover:bg-rose-100/70 hover:shadow-xs hover:-translate-y-0.5'
            }`}
            title="Click to filter by Lost or Expired"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-800">
                <span className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] leading-none">!</span>
                <span>Lost / Expired</span>
              </div>
              <div className="w-5 h-5 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-black font-mono text-slate-900 leading-none">
                {statusBreakdown.lost.count.toLocaleString()}
              </div>
              <div className="text-[11px] font-semibold text-rose-700 mt-1.5 flex items-center gap-1 truncate">
                <span className="text-slate-500 font-normal">Value:</span>
                <span className="font-mono font-bold">{formatCurrencyDisplay(statusBreakdown.lost.amount)}</span>
              </div>
            </div>
          </div>

          {/* Card 6: Need Amendment / Under Review (Soft Purple Card) */}
          <div
            onClick={() => handleStatusCardClick('Need Amendment')}
            className={`p-3.5 rounded-2xl shadow-2xs relative flex flex-col justify-between cursor-pointer transition-all ${
              isStatusCardActive('Need Amendment')
                ? 'bg-purple-100 border-2 border-purple-600 shadow-md ring-2 ring-purple-400/40 scale-[1.01]'
                : 'bg-purple-50/85 border border-purple-200/80 hover:bg-purple-100/70 hover:shadow-xs hover:-translate-y-0.5'
            }`}
            title="Click to filter by Need Amendment or Under Review"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-800">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                <span>Amendment</span>
              </div>
              <div className="w-5 h-5 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-black font-mono text-slate-900 leading-none">
                {statusBreakdown.amendment.count.toLocaleString()}
              </div>
              <div className="text-[11px] font-semibold text-purple-700 mt-1.5 flex items-center gap-1 truncate">
                <span className="text-slate-500 font-normal">Value:</span>
                <span className="font-mono font-bold">{formatCurrencyDisplay(statusBreakdown.amendment.amount)}</span>
              </div>
            </div>
          </div>

        </div>

        {/* ── Active Excel Filters Bar ── */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 bg-emerald-50 border border-emerald-300 rounded-xl px-3.5 py-2 text-xs text-emerald-900 shadow-xs">
            <span className="font-bold flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
              </svg>
              Excel Filters Applied ({activeFilterCount}):
            </span>

            {columnFilters.qtnNo && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-emerald-300 text-emerald-800 text-[11px] font-semibold">
                No: "{columnFilters.qtnNo}"
                <button onClick={() => clearSingleFilter('qtnNo')} className="hover:text-rose-600">×</button>
              </span>
            )}

            {(columnFilters.dateFrom || columnFilters.dateTo) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-emerald-300 text-emerald-800 text-[11px] font-semibold">
                Date: {columnFilters.dateFrom || 'start'} to {columnFilters.dateTo || 'end'}
                <button onClick={() => clearSingleFilter('dateFrom')} className="hover:text-rose-600">×</button>
              </span>
            )}

            {columnFilters.customers && columnFilters.customers.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-emerald-300 text-emerald-800 text-[11px] font-semibold">
                Customer ({columnFilters.customers.length})
                <button onClick={() => clearSingleFilter('customers')} className="hover:text-rose-600">×</button>
              </span>
            )}

            {columnFilters.contactPerson && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-emerald-300 text-emerald-800 text-[11px] font-semibold">
                Contact: "{columnFilters.contactPerson}"
                <button onClick={() => clearSingleFilter('contactPerson')} className="hover:text-rose-600">×</button>
              </span>
            )}

            {(columnFilters.amountMin !== undefined || columnFilters.amountMax !== undefined) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-emerald-300 text-emerald-800 text-[11px] font-semibold">
                Amount: ₹{columnFilters.amountMin || 0} – ₹{columnFilters.amountMax || '∞'}
                <button onClick={() => clearSingleFilter('amountMin')} className="hover:text-rose-600">×</button>
              </span>
            )}

            {columnFilters.statuses && columnFilters.statuses.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-emerald-300 text-emerald-800 text-[11px] font-semibold">
                Status ({columnFilters.statuses.length})
                <button onClick={() => clearSingleFilter('statuses')} className="hover:text-rose-600">×</button>
              </span>
            )}

            {columnFilters.salesPersonIds && columnFilters.salesPersonIds.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-emerald-300 text-emerald-800 text-[11px] font-semibold">
                Staff ({columnFilters.salesPersonIds.length})
                <button onClick={() => clearSingleFilter('salesPersonIds')} className="hover:text-rose-600">×</button>
              </span>
            )}

            {columnFilters.comments && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-emerald-300 text-emerald-800 text-[11px] font-semibold">
                Comment: "{columnFilters.comments}"
                <button onClick={() => clearSingleFilter('comments')} className="hover:text-rose-600">×</button>
              </span>
            )}

            <button
              type="button"
              onClick={clearAllFilters}
              className="ml-auto text-xs font-bold text-rose-600 hover:text-rose-800 underline cursor-pointer"
            >
              Clear All Filters
            </button>
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
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border} hover:shadow-xs transition-all cursor-pointer`}>
                    {status}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setSelectedQuotationIds(new Set())} className="ml-auto text-indigo-200 hover:text-white text-xs cursor-pointer">
              Deselect all
            </button>
          </div>
        )}

        {/* ── DESKTOP EXCEL TYPE TABLE VIEW ── */}
        {viewMode === 'excel' && (
          <div className="hidden md:block bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-h-[75vh] overflow-y-auto">
              <table className="min-w-full border-collapse border border-slate-300 text-xs">
                <thead className="sticky top-0 z-20 shadow-xs">
                  <tr className="bg-slate-100 divide-x divide-slate-300 border-b-2 border-slate-300">
                    
                    {/* Excel Row Index Header */}
                    <th className="px-2 py-2 text-center text-[10px] font-bold text-slate-500 bg-slate-200 w-10 border border-slate-300">
                      #
                    </th>

                    {/* Bulk Selection Checkbox */}
                    <th className="px-2 py-2 text-center w-8 border border-slate-300 bg-slate-100">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        title="Select All"
                      />
                    </th>

                    {/* No */}
                    <ExcelHeaderCell
                      title="Quotation No"
                      columnKey="qtnNo"
                      sortKey="id"
                      type="text"
                      className="w-[110px]"
                      sortAscLabel="Sort Smallest to Largest"
                      sortDescLabel="Sort Largest to Smallest"
                    />

                    {/* Date */}
                    <ExcelHeaderCell
                      title="Date"
                      columnKey="dateFrom"
                      sortKey="quotationDate"
                      type="date"
                      className="w-[105px]"
                      sortAscLabel="Sort Oldest to Newest"
                      sortDescLabel="Sort Newest to Oldest"
                    />

                    {/* Customer */}
                    <ExcelHeaderCell
                      title="Customer Name"
                      columnKey="customers"
                      sortKey="customer"
                      type="checklist"
                      checklistOptions={distinctCustomers}
                      className="min-w-[200px]"
                    />

                    {/* Contact Person */}
                    <ExcelHeaderCell
                      title="Contact Person"
                      columnKey="contactPerson"
                      sortKey="contactPerson"
                      type="text"
                      className="w-[140px]"
                    />

                    {/* Total Amount */}
                    <ExcelHeaderCell
                      title="Amount (₹)"
                      columnKey="amountMin"
                      sortKey="totalAmount"
                      type="number-range"
                      className="text-right w-[115px]"
                      sortAscLabel="Sort Smallest to Largest"
                      sortDescLabel="Sort Largest to Smallest"
                    />

                    {/* Status */}
                    <ExcelHeaderCell
                      title="Status"
                      columnKey="statuses"
                      sortKey="status"
                      type="checklist"
                      checklistOptions={distinctStatuses}
                      className="w-[140px]"
                    />

                    {/* Sales Person */}
                    <ExcelHeaderCell
                      title="Sales Person"
                      columnKey="salesPersonIds"
                      sortKey="salesPerson"
                      type="checklist"
                      checklistOptions={distinctSalesPersons}
                      className="w-[130px]"
                    />

                    {/* Comments */}
                    <ExcelHeaderCell
                      title="Comments"
                      columnKey="comments"
                      sortKey="comments"
                      type="text"
                      className="min-w-[150px]"
                    />

                    {/* Actions */}
                    <th className="px-3 py-2 text-center text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 w-[100px]">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredAndSortedQuotations.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-16 bg-white">
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 4h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-sm font-bold text-slate-600">No matching quotations found in grid</p>
                          <p className="text-xs">Adjust your Excel filters or universal search query</p>
                          {activeFilterCount > 0 && (
                            <button
                              onClick={clearAllFilters}
                              className="mt-2 px-3 py-1 bg-emerald-600 text-white rounded text-xs font-bold shadow-xs hover:bg-emerald-700"
                            >
                              Reset All Filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : paginatedQuotations.map((q, rowIdx) => {
                    const isSelected = selectedQuotationIds.has(q.id);
                    const amount = calculateTotalAmount(q);
                    const actualRowNumber = (pageSize === 0 ? 0 : (currentPage - 1) * pageSize) + rowIdx + 1;

                    return (
                      <tr
                        key={q.id}
                        className={`divide-x divide-slate-200 border-b border-slate-200 transition-colors ${
                          isSelected
                            ? 'bg-blue-100/70 hover:bg-blue-100'
                            : rowIdx % 2 === 0
                            ? 'bg-white hover:bg-slate-50'
                            : 'bg-slate-50/50 hover:bg-slate-50'
                        }`}
                      >
                        {/* Excel Row Index */}
                        <td className="px-2 py-1 text-center font-mono text-[10px] text-slate-400 bg-slate-50 select-none border-r border-slate-300">
                          {actualRowNumber}
                        </td>

                        {/* Checkbox */}
                        <td className="px-2 py-1 text-center border-r border-slate-200">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectOne(q.id)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>

                        {/* Quotation No */}
                        <td className="px-2.5 py-1 whitespace-nowrap border-r border-slate-200">
                          <button
                            type="button"
                            onClick={() => handleEdit(q.id)}
                            className="font-bold text-indigo-700 hover:text-indigo-900 hover:underline font-mono text-xs cursor-pointer"
                            title={generateFormattedQuotationNumber(q, quotations || [])}
                          >
                            {getQuotationSeqNum(q, quotations || [])}
                          </button>
                        </td>

                        {/* Date */}
                        <td className="px-2.5 py-1 text-slate-700 whitespace-nowrap font-mono text-[11px] border-r border-slate-200">
                          {formatDate(q.quotationDate)}
                        </td>

                        {/* Customer */}
                        <td className="px-2.5 py-1 min-w-[200px] max-w-[280px] border-r border-slate-200">
                          <div className="font-bold text-slate-800 truncate" title={getCustomerName(q.customerId)}>
                            {getCustomerName(q.customerId)}
                          </div>
                        </td>

                        {/* Contact Person */}
                        <td className="px-2.5 py-1 w-[140px] border-r border-slate-200">
                          <div className="font-semibold text-slate-700 truncate" title={q.contactPerson || ''}>
                            {q.contactPerson || '—'}
                          </div>
                          {q.contactNumber && (
                            <div className="text-[10px] text-indigo-600 font-mono flex items-center gap-0.5 mt-0.5">
                              📞 {q.contactNumber}
                            </div>
                          )}
                        </td>

                        {/* Amount */}
                        <td className="px-2.5 py-1 text-right whitespace-nowrap font-mono font-bold text-slate-900 border-r border-slate-200 bg-slate-50/30">
                          ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Status */}
                        <td className="px-2 py-1 border-r border-slate-200">
                          <StatusBadge status={q.status} onChange={s => handleStatusChange(q.id, s)} />
                        </td>

                        {/* Sales Person */}
                        <td className="px-2 py-1 w-[130px] border-r border-slate-200">
                          <select
                            value={q.salesPersonId || ''}
                            onChange={e => {
                              if (!e.target.value) return;
                              const newSpId = Number(e.target.value);
                              setQuotations(prev => (prev || []).map(qt => qt.id === q.id ? { ...qt, salesPersonId: newSpId } : qt));
                            }}
                            className="w-full bg-transparent text-[11px] font-semibold text-slate-700 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400 rounded px-1.5 py-0.5 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <option value="">Select SP</option>
                            {salesPersons?.map(sp => (
                              <option key={sp.id} value={sp.id}>{sp.name}</option>
                            ))}
                          </select>
                        </td>

                        {/* Comments */}
                        <td className="px-2 py-1 min-w-[150px] border-r border-slate-200">
                          <input
                            type="text"
                            defaultValue={q.comments || ''}
                            onBlur={e => handleCommentChange(q.id, e.target.value)}
                            className="w-full bg-transparent text-[11px] text-slate-600 placeholder-slate-300 border-0 focus:outline-none focus:ring-1 focus:ring-indigo-400 rounded px-1 py-0.5 hover:bg-slate-100 transition-colors"
                            placeholder="Add comment..."
                          />
                        </td>

                        {/* Actions */}
                        <td className="px-2 py-1 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEmailModalQuotation(q)}
                              title="Share Quotation"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 transition-all shadow-2xs hover:scale-105 cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEdit(q.id)}
                              title="Open Quotation"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 transition-all shadow-2xs hover:scale-105 cursor-pointer"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            {userRole === 'Admin' && (
                              <button
                                type="button"
                                onClick={() => handleDelete(q.id)}
                                title="Delete Quotation"
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-rose-500 hover:text-rose-600 bg-rose-50 hover:bg-rose-100/80 transition-all shadow-2xs hover:scale-105 cursor-pointer"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  <line x1="10" y1="11" x2="10" y2="17" />
                                  <line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Excel Status Bar at the bottom of the grid */}
            <div className="bg-slate-100 border-t border-slate-300 px-4 py-2 flex flex-wrap items-center justify-between text-xs text-slate-700 select-none">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  READY
                </span>
                <span>
                  Records: <strong>{totalItems.toLocaleString()}</strong> of {quotations.length.toLocaleString()}
                </span>
                {selectedStats.hasSelection && (
                  <span className="bg-blue-100 text-blue-900 px-2 py-0.5 rounded font-bold">
                    Selected: {selectedStats.selectedCount} row{selectedStats.selectedCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 font-mono font-medium">
                <div>
                  <span className="text-slate-500 text-[11px]">Average: </span>
                  <span className="font-bold text-slate-800">
                    ₹{Math.round(selectedStats.avg).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="border-l border-slate-300 pl-4">
                  <span className="text-slate-500 text-[11px]">Sum: </span>
                  <span className="font-bold text-emerald-700 text-sm">
                    ₹{selectedStats.sum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STANDARD VIEW (Card/Standard Table View) ── */}
        {viewMode === 'standard' && (
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto max-h-[75vh] overflow-y-auto">
              <table className="min-w-full">
                <thead className="sticky top-0 z-20 bg-[#f8fafc] border-b border-slate-200 shadow-2xs select-none">
                  <tr>
                    <th className="py-3.5 px-3 w-10 text-center bg-[#f8fafc]">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-3.5 px-3 text-left text-[10px] font-extrabold text-slate-600 uppercase tracking-wider cursor-pointer bg-[#f8fafc] whitespace-nowrap" onClick={() => handleSort('id')}>
                      QUOTATION NO {sortBy === 'id' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="py-3.5 px-3 text-left text-[10px] font-extrabold text-slate-600 uppercase tracking-wider cursor-pointer bg-[#f8fafc]" onClick={() => handleSort('quotationDate')}>
                      DATE {sortBy === 'quotationDate' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="py-3.5 px-3 text-left text-[10px] font-extrabold text-slate-600 uppercase tracking-wider cursor-pointer bg-[#f8fafc]" onClick={() => handleSort('customer')}>
                      CUSTOMER {sortBy === 'customer' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="py-3.5 px-3 text-left text-[10px] font-extrabold text-slate-600 uppercase tracking-wider cursor-pointer bg-[#f8fafc]" onClick={() => handleSort('contactPerson')}>
                      CONTACT {sortBy === 'contactPerson' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="py-3.5 px-3 text-right text-[10px] font-extrabold text-slate-600 uppercase tracking-wider cursor-pointer bg-[#f8fafc]" onClick={() => handleSort('totalAmount')}>
                      AMOUNT {sortBy === 'totalAmount' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="py-3.5 px-3 text-center text-[10px] font-extrabold text-slate-600 uppercase tracking-wider cursor-pointer bg-[#f8fafc]" onClick={() => handleSort('status')}>
                      STATUS {sortBy === 'status' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="py-3.5 px-3 text-center text-[10px] font-extrabold text-slate-600 uppercase tracking-wider bg-[#f8fafc]">
                      VALIDITY
                    </th>
                    <th className="py-3.5 px-2 text-center text-[10px] font-extrabold text-slate-600 uppercase tracking-wider bg-[#f8fafc]">
                      ITEMS
                    </th>
                    <th className="py-3.5 px-3 text-left text-[10px] font-extrabold text-slate-600 uppercase tracking-wider cursor-pointer bg-[#f8fafc]" onClick={() => handleSort('salesPerson')}>
                      SALES PERSON {sortBy === 'salesPerson' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="py-3.5 px-3 text-left text-[10px] font-extrabold text-slate-600 uppercase tracking-wider bg-[#f8fafc] min-w-[200px]">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        COMMENTS
                      </span>
                    </th>
                    <th className="sticky right-0 z-30 bg-[#f8fafc] shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.08)] py-3 px-3 text-center text-[10px] font-extrabold text-slate-600 uppercase tracking-wider w-[125px]">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedQuotations.map((q, rowIdx) => {
                    const isSelected = selectedQuotationIds.has(q.id);
                    const amount = calculateTotalAmount(q);
                    const actualRowNumber = (pageSize === 0 ? 0 : (currentPage - 1) * pageSize) + rowIdx + 1;
                    const commentCount = q.commentsList?.length || (q.comments ? 1 : 0);

                    return (
                      <tr
                        key={q.id}
                        onDoubleClick={() => handleEdit(q.id)}
                        className={`group transition-colors ${
                          isSelected ? 'bg-blue-50/70' : rowIdx % 2 === 0 ? 'bg-white hover:bg-slate-50/70' : 'bg-slate-50/30 hover:bg-slate-50/70'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-3 py-3 text-center">
                          <input 
                            type="checkbox" 
                            checked={isSelected} 
                            onChange={() => handleSelectOne(q.id)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                          />
                        </td>

                        {/* QUOTATION NO (Clickable to open) */}
                        <td className="px-3 py-3 text-slate-700 text-xs font-semibold whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleEdit(q.id)}
                            className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1"
                            title={`Open Quotation ${generateFormattedQuotationNumber(q, quotations || [])}`}
                          >
                            <span>{generateFormattedQuotationNumber(q, quotations || [])}</span>
                          </button>
                        </td>

                        {/* DATE */}
                        <td className="px-3 py-3 text-xs text-slate-700 whitespace-nowrap font-medium">
                          {formatDisplayDate(q.quotationDate)}
                        </td>

                        {/* CUSTOMER (Clickable to open) */}
                        <td className="px-3 py-3 min-w-[170px] max-w-[240px]">
                          <button
                            type="button"
                            onClick={() => handleEdit(q.id)}
                            className="text-left font-bold text-slate-900 hover:text-blue-600 transition-colors uppercase tracking-tight truncate block w-full cursor-pointer"
                            title={`Open Quotation: ${getCustomerName(q.customerId)}`}
                          >
                            {getCustomerName(q.customerId)}
                          </button>
                          <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                            {getCustomerCity(q.customerId) || 'Karnataka, India'}
                          </p>
                        </td>

                        {/* CONTACT */}
                        <td className="px-3 py-3 min-w-[130px] max-w-[180px]">
                          <p className="text-xs font-semibold text-slate-800 truncate" title={q.contactPerson || ''}>
                            {q.contactPerson || '—'}
                          </p>
                          <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                            {q.contactNumber ? q.contactNumber : 'contact@client.com'}
                          </p>
                        </td>

                        {/* AMOUNT */}
                        <td className="px-3 py-3 text-right whitespace-nowrap font-mono font-bold text-slate-900 text-xs">
                          ₹{amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>

                        {/* STATUS */}
                        <td className="px-2 py-3 text-center">
                          <StatusBadge status={q.status} onChange={s => handleStatusChange(q.id, s)} />
                        </td>

                        {/* VALIDITY */}
                        <td className="px-3 py-3 text-center whitespace-nowrap text-xs text-slate-600 font-medium">
                          {getValidityDate(q.quotationDate)}
                        </td>

                        {/* ITEMS */}
                        <td className="px-2 py-3 text-center text-xs font-semibold text-slate-700">
                          {q.details?.length || 0}
                        </td>

                        {/* SALES PERSON */}
                        <td className="px-3 py-3 min-w-[110px]">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {getSalesPersonName(q.salesPersonId)}
                          </p>
                          <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                            Inside Sales
                          </p>
                        </td>

                        {/* COMMENTS */}
                        <td className="px-3 py-3 min-w-[160px] max-w-[210px]">
                          <div className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 shadow-2xs">
                              {commentCount}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-slate-700 font-medium truncate" title={q.comments || ''}>
                                {q.comments || 'No comments'}
                              </p>
                              <button
                                type="button"
                                onClick={() => setSelectedSidePanelQuotation(q)}
                                className="text-[11px] text-slate-400 hover:text-blue-600 font-medium transition-colors cursor-pointer text-left block mt-0.5"
                              >
                                Add comment
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* ACTIONS (Sticky so it is always visible on screen) */}
                        <td className={`sticky right-0 z-10 px-3 py-3 text-center whitespace-nowrap shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.08)] ${
                          isSelected ? 'bg-blue-50' : rowIdx % 2 === 0 ? 'bg-white group-hover:bg-slate-50' : 'bg-[#fafbfe] group-hover:bg-slate-50'
                        }`}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleEdit(q.id)}
                              title="Open Quotation"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-600 hover:text-white transition-all shadow-2xs hover:scale-105 cursor-pointer"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                              <span>Open</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEmailModalQuotation(q)}
                              title="Share Quotation"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                              </svg>
                            </button>
                            {userRole === 'Admin' && (
                              <button
                                type="button"
                                onClick={() => handleDelete(q.id)}
                                title="Delete Quotation"
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Mobile Cards ── */}
        <div className="block md:hidden space-y-2">
          {paginatedQuotations.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">No quotations found</div>
          ) : paginatedQuotations.map(q => {
            const amount = calculateTotalAmount(q);
            const cfg = getStatusCfg(q.status);
            return (
              <div key={q.id} className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className={`h-1 w-full ${cfg.dot}`} />
                <div className="p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <button onClick={() => handleEdit(q.id)} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                        {getQuotationSeqNum(q, quotations || [])}
                      </button>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{getCustomerName(q.customerId)}</p>
                      
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-slate-400">{formatDate(q.quotationDate)} ·</span>
                        <select
                          value={q.salesPersonId || ''}
                          onChange={e => {
                            if (!e.target.value) return;
                            const newSpId = Number(e.target.value);
                            setQuotations(prev => (prev || []).map(qt => qt.id === q.id ? { ...qt, salesPersonId: newSpId } : qt));
                          }}
                          className="bg-transparent border-0 p-0 text-xs font-medium text-slate-500 focus:outline-none cursor-pointer max-w-[120px]"
                        >
                          <option value="">Select SP</option>
                          {salesPersons?.map(sp => (
                            <option key={sp.id} value={sp.id}>{sp.name}</option>
                          ))}
                        </select>
                      </div>

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
                          📞 {q.contactNumber}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-2">
                    <input
                      type="text"
                      defaultValue={q.comments || ''}
                      onBlur={e => handleCommentChange(q.id, e.target.value)}
                      className="w-full bg-slate-50 text-[11px] text-slate-600 placeholder-slate-400 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400 rounded px-2 py-1.5 transition-colors"
                      placeholder="Add comment..."
                    />
                  </div>

                  <div className="flex justify-end gap-3 border-t border-slate-100 pt-2 mt-2">
                    <button onClick={() => setEmailModalQuotation(q)} className="text-emerald-600 text-xs font-medium hover:text-emerald-700 cursor-pointer">Share</button>
                    <button onClick={() => handleEdit(q.id)} className="text-indigo-600 text-xs font-medium hover:text-indigo-700 cursor-pointer">Open</button>
                    {userRole === 'Admin' && (
                      <button onClick={() => handleDelete(q.id)} className="text-rose-500 text-xs font-medium hover:text-rose-700 cursor-pointer">Delete</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Modern Pagination & Side Panel Bar ── */}
        {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 my-4 px-4 py-3 bg-white rounded-2xl border border-slate-200/90 text-xs text-slate-600 shadow-2xs">
            
            {/* Left: Showing Range & Load Older Button */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-xs text-slate-500 font-medium">
                Showing <span className="font-bold text-slate-800">{pageSize === 0 ? 1 : Math.min((currentPage - 1) * pageSize + 1, totalItems)}</span> to{' '}
                <span className="font-bold text-slate-800">{pageSize === 0 ? totalItems : Math.min(currentPage * pageSize, totalItems)}</span> of{' '}
                <span className="font-bold text-slate-900">{totalItems}</span> quotations
              </div>
              <button
                type="button"
                onClick={handleLoadOlderOffers}
                disabled={isLoadingOlder || hasReachedEnd}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                title="Load 100 more historical quotations from cloud database"
              >
                {isLoadingOlder ? (
                  <>
                    <div className="w-3 h-3 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                    <span>Loading older offers...</span>
                  </>
                ) : hasReachedEnd ? (
                  <span>✓ All offers loaded ({quotations?.length || 0})</span>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <span>Load Older Offers (+100)</span>
                  </>
                )}
              </button>
            </div>

            {/* Center: Numeric Page Numbers */}
            <div className="flex items-center gap-1.5 select-none">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ‹
              </button>

              {Array.from({ length: Math.min(totalPages, 6) }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-all ${
                    currentPage === page
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {page}
                </button>
              ))}

              {totalPages > 6 && (
                <>
                  <span className="text-slate-400 font-bold px-1">...</span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-all ${
                      currentPage === totalPages
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {totalPages}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ›
              </button>
            </div>

            {/* Right: Side Panel Button Matching User Mockup */}
            <button
              type="button"
              onClick={() => {
                if (paginatedQuotations.length > 0) {
                  setSelectedSidePanelQuotation(selectedSidePanelQuotation ? null : paginatedQuotations[0]);
                }
              }}
              className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border border-blue-200/90 bg-blue-50/70 hover:bg-blue-100/80 text-blue-900 text-xs font-semibold transition-all shadow-2xs cursor-pointer"
            >
              <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center text-xs shadow-2xs">
                📑
              </div>
              <div className="text-left">
                <span className="font-bold block leading-tight">Side Panel</span>
                <span className="text-[10px] text-blue-600/80 font-normal hidden sm:block">View detailed comments, history and attachments</span>
              </div>
            </button>

          </div>
        )}

        {/* ── SLIDE-OVER SIDE PANEL DRAWER ── */}
        {selectedSidePanelQuotation && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-2xs transition-opacity animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-250">
              
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-900 to-indigo-900 text-white">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-200 font-mono">
                      #{getQuotationSeqNum(selectedSidePanelQuotation, quotations || [])}
                    </span>
                    <StatusBadge status={selectedSidePanelQuotation.status} onChange={s => handleStatusChange(selectedSidePanelQuotation.id, s)} />
                  </div>
                  <h3 className="text-sm font-bold text-white mt-1 truncate max-w-xs">
                    {getCustomerName(selectedSidePanelQuotation.customerId)}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSidePanelQuotation(null)}
                  className="w-8 h-8 rounded-full text-slate-300 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors text-xl font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/50">
                
                {/* Quotation Snapshot Pod */}
                <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-2xs space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Date</span>
                    <span className="font-semibold text-slate-800">{formatDisplayDate(selectedSidePanelQuotation.quotationDate)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Validity</span>
                    <span className="font-semibold text-slate-800">{getValidityDate(selectedSidePanelQuotation.quotationDate)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Sales Person</span>
                    <span className="font-semibold text-slate-800">{getSalesPersonName(selectedSidePanelQuotation.salesPersonId)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-2">
                    <span className="text-slate-700 font-bold">Total Amount</span>
                    <span className="font-bold text-base text-blue-600 font-mono">
                      ₹{calculateTotalAmount(selectedSidePanelQuotation).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Items Summary */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span>Items ({selectedSidePanelQuotation.details?.length || 0})</span>
                    <button 
                      onClick={() => handleEdit(selectedSidePanelQuotation.id)}
                      className="text-blue-600 hover:underline"
                    >
                      Edit Quote →
                    </button>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200/80 divide-y divide-slate-100 max-h-48 overflow-y-auto text-xs">
                    {selectedSidePanelQuotation.details?.map((item, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <span className="font-bold text-slate-900 block truncate">{item.partNo || 'Item'}</span>
                          <span className="text-[11px] text-slate-500 truncate block">{item.description}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-slate-500 font-medium block">Qty: {item.moq}</span>
                          <span className="font-bold text-slate-800 font-mono block">₹{(item.price * item.moq).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Comments & Activity Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    <span>Comments & Activity History</span>
                  </div>

                  {/* Comments Timeline */}
                  <div className="space-y-2.5 max-h-60 overflow-y-auto">
                    {selectedSidePanelQuotation.commentsList && selectedSidePanelQuotation.commentsList.length > 0 ? (
                      selectedSidePanelQuotation.commentsList.map((c, i) => (
                        <div key={c.id || i} className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs space-y-1 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-800">{c.userName}</span>
                            <span className="text-[10px] text-slate-400">{new Date(c.timestamp).toLocaleDateString()}</span>
                          </div>
                          <p className="text-slate-600 text-xs leading-relaxed">{c.text}</p>
                        </div>
                      ))
                    ) : selectedSidePanelQuotation.comments ? (
                      <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs space-y-1 text-xs">
                        <span className="font-bold text-slate-800 block">General Comment</span>
                        <p className="text-slate-600 text-xs leading-relaxed">{selectedSidePanelQuotation.comments}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic text-center py-4">No comments recorded yet.</p>
                    )}
                  </div>

                  {/* Add Comment Input */}
                  <div className="bg-white rounded-xl p-2.5 border border-slate-200 shadow-2xs space-y-2">
                    <textarea
                      rows={2}
                      value={sidePanelComment}
                      onChange={e => setSidePanelComment(e.target.value)}
                      placeholder="Type a new comment or update note..."
                      className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handlePostSidePanelComment}
                        disabled={isPostingComment || !sidePanelComment.trim()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        {isPostingComment ? 'Saving...' : 'Post Comment'}
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-3.5 border-t border-slate-200 bg-white flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setEmailModalQuotation(selectedSidePanelQuotation)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Share Quote
                </button>
                <button
                  type="button"
                  onClick={() => handleEdit(selectedSidePanelQuotation.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs cursor-pointer"
                >
                  Open Full Editor →
                </button>
              </div>

            </div>
          </div>
        )}

        <ShareModal 
          isOpen={!!emailModalQuotation}
          onClose={() => setEmailModalQuotation(null)}
          quotation={emailModalQuotation}
          salesPerson={emailModalQuotation ? (salesPersons?.find(s => s.id === emailModalQuotation.salesPersonId) || null) : null}
          quotations={quotations || []}
          customerName={emailModalQuotation ? getCustomerName(emailModalQuotation.customerId) : ''}
        />
      </div>
    </div>
  );
};
