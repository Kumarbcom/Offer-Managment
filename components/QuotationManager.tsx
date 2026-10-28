import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Quotation, SalesPerson, QuotationStatus, User, Customer } from '../types';
import { QUOTATION_STATUSES } from '../constants';
import { generateFormattedQuotationNumber, getQuotationSeqNum } from '../utils/quotationNumber';
import { ShareModal } from './ShareModal';
import { ExcelTableColumnFilter, ChecklistOption } from './ExcelTableColumnFilter';

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
  'Open':                { label: 'Open',               dot: 'bg-blue-500',   bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  'PO received':         { label: 'PO Received',        dot: 'bg-emerald-500',bg: 'bg-emerald-50',text: 'text-emerald-700',border: 'border-emerald-200' },
  'Partial PO Received': { label: 'Partial PO',         dot: 'bg-teal-500',   bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200' },
  'Expired':             { label: 'Expired',            dot: 'bg-amber-500',  bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  'Lost':                { label: 'Lost',               dot: 'bg-rose-500',   bg: 'bg-rose-50',   text: 'text-rose-700',   border: 'border-rose-200' },
  'Under Review':        { label: 'Under Review',       dot: 'bg-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  'Need Amendment':      { label: 'Need Amendment',     dot: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
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

  // View Mode: 'excel' (Spreadsheet table with column filters) or 'standard' (Card/clean table)
  const [viewMode, setViewMode] = useState<'excel' | 'standard'>('excel');

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
          const amt = calculateTotalAmount(q.details);
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
          case 'totalAmount': comparison = calculateTotalAmount(a.details) - calculateTotalAmount(b.details); break;
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
    const sum = targetList.reduce((acc, q) => acc + calculateTotalAmount(q.details), 0);
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

  // Summary stats
  const stats = useMemo(() => {
    const list = filteredAndSortedQuotations;
    const total = list.reduce((s, q) => s + calculateTotalAmount(q.details), 0);
    const open = list.filter(q => q.status === 'Open').length;
    const won = list.filter(q => q.status === 'PO received' || q.status === 'Partial PO Received').length;
    const lost = list.filter(q => q.status === 'Lost').length;
    return { count: list.length, total, open, won, lost };
  }, [filteredAndSortedQuotations]);

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

      {/* ── Top Header Toolbar ── */}
      <div className="bg-white border-b border-slate-200 shadow-xs sticky top-0 z-30">
        <div className="px-4 md:px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            
            {/* Title & Badge */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center shadow-md shadow-emerald-200 text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 4h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight">Quotations</h1>
                <p className="text-xs text-slate-500 font-medium">
                  {stats.count} record{stats.count !== 1 ? 's' : ''} found
                  {stats.count !== (quotations?.length || 0) && (
                    <span className="text-indigo-600 ml-1 font-semibold">(filtered from {quotations?.length})</span>
                  )}
                </p>
              </div>
            </div>

            {/* Actions & View Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              
              {/* Universal Search */}
              <div className="relative">
                <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 focus:bg-white transition-all w-44 md:w-56"
                  placeholder="Universal search..."
                  value={universalSearchTerm}
                  onChange={e => setUniversalSearchTerm(e.target.value)}
                />
                {universalSearchTerm && (
                  <button onClick={() => setUniversalSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                  </button>
                )}
              </div>

              {/* View Switcher: Excel View vs Standard View */}
              <div className="hidden sm:inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewMode('excel')}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    viewMode === 'excel'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Spreadsheet Excel grid with sort & filter headers"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 4h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Excel View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('standard')}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    viewMode === 'standard'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Standard cards & table view"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  <span>Standard View</span>
                </button>
              </div>

              {/* Export to Excel */}
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs cursor-pointer"
                title="Download full quotation details as Excel (.xlsx)"
              >
                <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                <span>Export</span>
              </button>

              {/* New Quotation Button */}
              {canEdit && (
                <button
                  onClick={handleAddNew}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-xs shadow-indigo-200 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                  <span>New Quotation</span>
                </button>
              )}

              {onBackToCustomers && (
                <button onClick={onBackToCustomers} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-all cursor-pointer">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                  <span>Back</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 md:px-6 py-4 space-y-3">

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
                    const amount = calculateTotalAmount(q.details);
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
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEmailModalQuotation(q)}
                              title="Share Quotation"
                              className="w-6 h-6 rounded flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEdit(q.id)}
                              title="Open Quotation"
                              className="w-6 h-6 rounded flex items-center justify-center text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            {userRole === 'Admin' && (
                              <button
                                type="button"
                                onClick={() => handleDelete(q.id)}
                                title="Delete Quotation"
                                className="w-6 h-6 rounded flex items-center justify-center text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
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
                        className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </th>
                    <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => handleSort('id')}>
                      No {sortBy === 'id' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => handleSort('quotationDate')}>
                      Date {sortBy === 'quotationDate' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => handleSort('customer')}>
                      Customer {sortBy === 'customer' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => handleSort('contactPerson')}>
                      Contact {sortBy === 'contactPerson' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="px-3 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => handleSort('totalAmount')}>
                      Amount {sortBy === 'totalAmount' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => handleSort('status')}>
                      Status {sortBy === 'status' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => handleSort('salesPerson')}>
                      Sales Person {sortBy === 'salesPerson' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Comments</th>
                    <th className="px-3 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider w-[95px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedQuotations.map((q, rowIdx) => {
                    const isSelected = selectedQuotationIds.has(q.id);
                    const amount = calculateTotalAmount(q.details);
                    return (
                      <tr
                        key={q.id}
                        className={`group transition-colors ${isSelected ? 'bg-indigo-50/70' : rowIdx % 2 === 0 ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/40 hover:bg-slate-50/80'}`}
                      >
                        <td className="px-3 py-1.5">
                          <input type="checkbox" checked={isSelected} onChange={() => handleSelectOne(q.id)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                        </td>
                        <td className="px-3 py-1.5 w-[60px]">
                          <button
                            onClick={() => handleEdit(q.id)}
                            className="font-bold text-indigo-600 hover:text-indigo-800 text-xs transition-colors hover:underline whitespace-nowrap cursor-pointer"
                          >
                            {getQuotationSeqNum(q, quotations || [])}
                          </button>
                        </td>
                        <td className="px-3 py-1.5 text-xs text-slate-600 whitespace-nowrap">
                          {formatDate(q.quotationDate)}
                        </td>
                        <td className="px-3 py-1.5 min-w-[180px] max-w-[280px]">
                          <p className="text-xs font-semibold text-slate-800 truncate" title={getCustomerName(q.customerId)}>
                            {getCustomerName(q.customerId)}
                          </p>
                        </td>
                        <td className="px-3 py-1.5 w-[130px]">
                          <p className="text-xs font-semibold text-slate-700 truncate">{q.contactPerson || '—'}</p>
                          {q.contactNumber && (
                            <p className="text-[10px] text-indigo-600 font-semibold mt-0.5 whitespace-nowrap">
                              📞 {q.contactNumber}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap font-bold text-slate-900">
                          ₹{amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-3 py-1.5">
                          <StatusBadge status={q.status} onChange={s => handleStatusChange(q.id, s)} />
                        </td>
                        <td className="px-3 py-1.5 w-[120px]">
                          <select
                            value={q.salesPersonId || ''}
                            onChange={e => {
                              if (!e.target.value) return;
                              const newSpId = Number(e.target.value);
                              setQuotations(prev => (prev || []).map(qt => qt.id === q.id ? { ...qt, salesPersonId: newSpId } : qt));
                            }}
                            className="w-full bg-transparent text-[11px] font-semibold text-slate-700 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400 rounded px-1 py-0.5 cursor-pointer"
                          >
                            <option value="">Select SP</option>
                            {salesPersons?.map(sp => (
                              <option key={sp.id} value={sp.id}>{sp.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-1.5 min-w-[120px]">
                          <input
                            type="text"
                            defaultValue={q.comments || ''}
                            onBlur={e => handleCommentChange(q.id, e.target.value)}
                            className="w-full bg-transparent text-[11px] text-slate-600 placeholder-slate-300 border-0 focus:outline-none focus:ring-1 focus:ring-indigo-400 rounded px-1 py-0.5 hover:bg-slate-100"
                            placeholder="Add comment..."
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEmailModalQuotation(q)}
                              title="Share Quotation"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleEdit(q.id)}
                              title="Open Quotation"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            {userRole === 'Admin' && (
                              <button
                                onClick={() => handleDelete(q.id)}
                                title="Delete Quotation"
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-50 cursor-pointer"
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
              </table>
            </div>
          </div>
        )}

        {/* ── Mobile Cards ── */}
        <div className="block md:hidden space-y-2">
          {paginatedQuotations.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">No quotations found</div>
          ) : paginatedQuotations.map(q => {
            const amount = calculateTotalAmount(q.details);
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

        {/* ── Pagination Bar ── */}
        {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 my-3 px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 shadow-xs">
            <div className="flex items-center gap-1.5">
              <span>Showing</span>
              <span className="font-bold text-slate-800">
                {pageSize === 0 ? 1 : Math.min((currentPage - 1) * pageSize + 1, totalItems)}
              </span>
              <span>to</span>
              <span className="font-bold text-slate-800">
                {pageSize === 0 ? totalItems : Math.min(currentPage * pageSize, totalItems)}
              </span>
              <span>of</span>
              <span className="font-bold text-emerald-700">{totalItems}</span>
              <span>quotations</span>
            </div>

            <div className="flex items-center gap-3 flex-wrap justify-end">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={0}>All ({totalItems})</option>
                </select>
              </div>

              {pageSize > 0 && totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-2 py-1 border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed font-bold cursor-pointer"
                    title="First Page"
                  >
                    «
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1 border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed font-semibold cursor-pointer"
                  >
                    Prev
                  </button>
                  <span className="px-2 font-semibold text-slate-800">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1 border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed font-semibold cursor-pointer"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-2 py-1 border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed font-bold cursor-pointer"
                    title="Last Page"
                  >
                    »
                  </button>
                </div>
              )}
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
