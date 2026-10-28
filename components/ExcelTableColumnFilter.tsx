import React, { useState, useEffect, useRef } from 'react';

export interface ChecklistOption {
  label: string;
  value: string | number;
  count?: number;
}

export interface ExcelTableColumnFilterProps {
  columnKey: string;
  columnTitle: string;
  isOpen: boolean;
  onClose: () => void;
  // Sort
  onSortAsc: () => void;
  onSortDesc: () => void;
  currentSortKey: string;
  currentSortOrder: 'asc' | 'desc';
  sortAscLabel?: string;
  sortDescLabel?: string;
  // Filter types
  type: 'text' | 'date' | 'number-range' | 'checklist';
  // Text
  textValue?: string;
  onTextApply?: (val: string) => void;
  // Date
  dateFrom?: string;
  dateTo?: string;
  onDateApply?: (from?: string, to?: string) => void;
  // Range
  minVal?: number;
  maxVal?: number;
  onRangeApply?: (min?: number, max?: number) => void;
  // Checklist
  checklistOptions?: ChecklistOption[];
  selectedChecklistValues?: Array<string | number>;
  onChecklistApply?: (values: Array<string | number>) => void;
  // Clear
  isFiltered: boolean;
  onClear: () => void;
}

export const ExcelTableColumnFilter: React.FC<ExcelTableColumnFilterProps> = ({
  columnKey,
  columnTitle,
  isOpen,
  onClose,
  onSortAsc,
  onSortDesc,
  currentSortKey,
  currentSortOrder,
  sortAscLabel = 'Sort A to Z',
  sortDescLabel = 'Sort Z to A',
  type,
  textValue = '',
  onTextApply,
  dateFrom = '',
  dateTo = '',
  onDateApply,
  minVal,
  maxVal,
  onRangeApply,
  checklistOptions = [],
  selectedChecklistValues = [],
  onChecklistApply,
  isFiltered,
  onClear,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Local draft states so user can pick then click "OK / Apply"
  const [localText, setLocalText] = useState(textValue);
  const [localDateFrom, setLocalDateFrom] = useState(dateFrom);
  const [localDateTo, setLocalDateTo] = useState(dateTo);
  const [localMin, setLocalMin] = useState<string>(minVal !== undefined ? String(minVal) : '');
  const [localMax, setLocalMax] = useState<string>(maxVal !== undefined ? String(maxVal) : '');
  const [selectedSet, setSelectedSet] = useState<Set<string | number>>(new Set(selectedChecklistValues));
  const [checklistSearch, setChecklistSearch] = useState('');

  // Sync props when opening
  useEffect(() => {
    if (isOpen) {
      setLocalText(textValue);
      setLocalDateFrom(dateFrom);
      setLocalDateTo(dateTo);
      setLocalMin(minVal !== undefined ? String(minVal) : '');
      setLocalMax(maxVal !== undefined ? String(maxVal) : '');
      setSelectedSet(new Set(selectedChecklistValues));
      setChecklistSearch('');
    }
  }, [isOpen, textValue, dateFrom, dateTo, minVal, maxVal, selectedChecklistValues]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isCurrentSortAsc = currentSortKey === columnKey && currentSortOrder === 'asc';
  const isCurrentSortDesc = currentSortKey === columnKey && currentSortOrder === 'desc';

  const handleApply = () => {
    if (type === 'text' && onTextApply) {
      onTextApply(localText.trim());
    } else if (type === 'date' && onDateApply) {
      onDateApply(localDateFrom || undefined, localDateTo || undefined);
    } else if (type === 'number-range' && onRangeApply) {
      const min = localMin ? parseFloat(localMin) : undefined;
      const max = localMax ? parseFloat(localMax) : undefined;
      onRangeApply(min, max);
    } else if (type === 'checklist' && onChecklistApply) {
      onChecklistApply(Array.from(selectedSet));
    }
    onClose();
  };

  const handleClear = () => {
    onClear();
    onClose();
  };

  // Filtered options for checklist
  const filteredOptions = checklistOptions.filter(opt =>
    opt.label.toLowerCase().includes(checklistSearch.toLowerCase())
  );

  const isAllChecked =
    checklistOptions.length > 0 &&
    checklistOptions.every(opt => selectedSet.has(opt.value));

  const toggleSelectAll = () => {
    if (isAllChecked) {
      setSelectedSet(new Set());
    } else {
      setSelectedSet(new Set(checklistOptions.map(o => o.value)));
    }
  };

  const toggleOption = (val: string | number) => {
    const next = new Set(selectedSet);
    if (next.has(val)) {
      next.delete(val);
    } else {
      next.add(val);
    }
    setSelectedSet(next);
  };

  return (
    <div
      ref={containerRef}
      className="absolute top-full left-0 mt-1 w-64 sm:w-72 bg-white rounded-lg shadow-2xl border border-slate-300 z-50 text-slate-800 text-xs py-2 font-normal text-left"
      style={{ minWidth: '240px' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── Sort Section ── */}
      <div className="px-2 pb-2 border-b border-slate-100 space-y-1">
        <button
          type="button"
          onClick={() => { onSortAsc(); onClose(); }}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-slate-100 transition-colors ${
            isCurrentSortAsc ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            <span>{sortAscLabel}</span>
          </div>
          {isCurrentSortAsc && <span className="text-indigo-600 font-bold">✓</span>}
        </button>

        <button
          type="button"
          onClick={() => { onSortDesc(); onClose(); }}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-slate-100 transition-colors ${
            isCurrentSortDesc ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
            </svg>
            <span>{sortDescLabel}</span>
          </div>
          {isCurrentSortDesc && <span className="text-indigo-600 font-bold">✓</span>}
        </button>
      </div>

      {/* ── Clear Current Filter ── */}
      {isFiltered && (
        <div className="px-2 py-1.5 border-b border-slate-100">
          <button
            type="button"
            onClick={handleClear}
            className="w-full flex items-center gap-2 px-2.5 py-1 rounded text-rose-600 hover:bg-rose-50 font-semibold transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>Clear Filter from "{columnTitle}"</span>
          </button>
        </div>
      )}

      {/* ── Filter Controls Body ── */}
      <div className="p-2 space-y-2">
        {/* TEXT FILTER */}
        {type === 'text' && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Filter: Contains Text
            </label>
            <input
              type="text"
              value={localText}
              onChange={(e) => setLocalText(e.target.value)}
              placeholder={`Search ${columnTitle.toLowerCase()}...`}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleApply(); }}
            />
          </div>
        )}

        {/* DATE RANGE FILTER */}
        {type === 'date' && (
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Filter: Date Range
            </label>
            <div className="space-y-1.5">
              <div>
                <span className="text-[10px] text-slate-400 block">From Date:</span>
                <input
                  type="date"
                  value={localDateFrom}
                  onChange={(e) => setLocalDateFrom(e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">To Date:</span>
                <input
                  type="date"
                  value={localDateTo}
                  onChange={(e) => setLocalDateTo(e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* NUMBER RANGE FILTER (AMOUNT) */}
        {type === 'number-range' && (
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Filter: Amount (₹)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-400 block">Min ₹:</span>
                <input
                  type="number"
                  value={localMin}
                  onChange={(e) => setLocalMin(e.target.value)}
                  placeholder="Min"
                  className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Max ₹:</span>
                <input
                  type="number"
                  value={localMax}
                  onChange={(e) => setLocalMax(e.target.value)}
                  placeholder="Max"
                  className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* CHECKLIST FILTER (Customer / Status / Sales Person) */}
        {type === 'checklist' && (
          <div className="space-y-1.5">
            {/* Search inside checklist if > 5 options */}
            {checklistOptions.length > 5 && (
              <input
                type="text"
                value={checklistSearch}
                onChange={(e) => setChecklistSearch(e.target.value)}
                placeholder="Search values..."
                className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-1"
              />
            )}

            {/* Select All Checkbox */}
            <label className="flex items-center gap-2 px-1.5 py-1 hover:bg-slate-50 rounded cursor-pointer select-none font-semibold text-slate-700 border-b border-slate-100">
              <input
                type="checkbox"
                checked={isAllChecked}
                onChange={toggleSelectAll}
                className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>(Select All)</span>
            </label>

            {/* List */}
            <div className="max-h-48 overflow-y-auto space-y-0.5 divide-y divide-slate-50 pr-1">
              {filteredOptions.length === 0 ? (
                <div className="text-center py-3 text-slate-400 text-xs">No matches</div>
              ) : (
                filteredOptions.map((opt) => {
                  const checked = selectedSet.has(opt.value);
                  return (
                    <label
                      key={String(opt.value)}
                      className={`flex items-center justify-between gap-2 px-1.5 py-1 rounded cursor-pointer select-none hover:bg-slate-50 text-xs ${
                        checked ? 'font-semibold text-slate-900 bg-indigo-50/40' : 'text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOption(opt.value)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="truncate" title={opt.label}>{opt.label}</span>
                      </div>
                      {opt.count !== undefined && (
                        <span className="text-[10px] text-slate-400 font-mono">({opt.count})</span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Footer Actions ── */}
      <div className="px-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={handleClear}
          className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 rounded transition-colors"
        >
          Reset
        </button>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded transition-colors border border-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-3.5 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-xs transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
