import React, { useMemo, useState } from 'react';
import type { Quotation } from '../types';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface ItemWiseReportProps {
  quotations: Quotation[] | null;
  customerMap: Map<number, string>;
}

interface CustomerData {
  qty: number;
  amount: number;
}

interface ItemRow {
  partNo: string;
  description: string;
  customers: Record<number, CustomerData>;
  totalQty: number;
  totalAmount: number;
}

export const ItemWiseReport: React.FC<ItemWiseReportProps> = ({ quotations, customerMap }) => {
  const [partNoPrefix, setPartNoPrefix] = useState('46');

  const { rows, customerIds } = useMemo(() => {
    if (!quotations) return { rows: [], customerIds: [] };

    const itemMap = new Map<string, ItemRow>();
    const cIds = new Set<number>();

    quotations.forEach(q => {
      if (!q.customerId) return;
      
      // We process only confirmed or valid quotations? Let's process all in the filtered list or maybe just depend on what's passed.
      // Usually all quotations passed are relevant for the date range
      q.details?.forEach(item => {
        if (partNoPrefix && !item.partNo.startsWith(partNoPrefix)) return;

        if (!itemMap.has(item.partNo)) {
          itemMap.set(item.partNo, {
            partNo: item.partNo,
            description: item.description,
            customers: {},
            totalQty: 0,
            totalAmount: 0
          });
        }

        const row = itemMap.get(item.partNo)!;
        cIds.add(q.customerId!);

        if (!row.customers[q.customerId!]) {
          row.customers[q.customerId!] = { qty: 0, amount: 0 };
        }

        const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
        const amount = unitPrice * item.moq;

        row.customers[q.customerId!].qty += item.moq;
        row.customers[q.customerId!].amount += amount;

        row.totalQty += item.moq;
        row.totalAmount += amount;
      });
    });

    return {
      rows: Array.from(itemMap.values()).sort((a, b) => a.partNo.localeCompare(b.partNo)),
      customerIds: Array.from(cIds)
    };
  }, [quotations, partNoPrefix]);

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Item Wise Report');

    // Build Row 1: Main Headers (Customer Names)
    const row1 = ['Part No', 'Description'];
    customerIds.forEach(cid => {
      row1.push(customerMap.get(cid) || `Customer ${cid}`);
      row1.push(''); // Empty for merge
    });
    row1.push('Total');
    row1.push(''); // Empty for merge
    const headerRow1 = worksheet.addRow(row1);

    // Build Row 2: Sub Headers (Qty/Amount)
    const row2 = ['', '']; // Empty because they fall under PartNo/Description
    customerIds.forEach(() => {
      row2.push('Qty');
      row2.push('Amount');
    });
    row2.push('Qty');
    row2.push('Amount');
    const headerRow2 = worksheet.addRow(row2);

    // Merge Cells for Headers
    worksheet.mergeCells('A1:A2');
    worksheet.mergeCells('B1:B2');
    
    let currentCol = 3;
    customerIds.forEach(() => {
      worksheet.mergeCells(1, currentCol, 1, currentCol + 1);
      currentCol += 2;
    });
    // Total
    worksheet.mergeCells(1, currentCol, 1, currentCol + 1);

    // Style Headers
    [headerRow1, headerRow2].forEach(row => {
      row.eachCell(cell => {
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF3F4F6' } // bg-gray-100
        };
      });
    });

    // Add Data
    rows.forEach(r => {
      const rowData: any[] = [r.partNo, r.description];
      customerIds.forEach(cid => {
        const data = r.customers[cid];
        rowData.push(data ? data.qty : 0);
        rowData.push(data ? data.amount : 0);
      });
      rowData.push(r.totalQty);
      rowData.push(r.totalAmount);
      worksheet.addRow(rowData);
    });

    // Column Widths
    worksheet.getColumn(1).width = 15;
    worksheet.getColumn(2).width = 35;
    for (let i = 3; i <= 2 + customerIds.length * 2 + 2; i++) {
      worksheet.getColumn(i).width = 12;
      worksheet.getColumn(i).numFmt = '#,##0'; // formatting numbers
    }

    // Save
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `ItemWiseReport_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md mt-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-bold text-gray-700">Filter Part No Starts With:</label>
          <input 
            type="text" 
            value={partNoPrefix} 
            onChange={(e) => setPartNoPrefix(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="e.g. 46"
          />
        </div>
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition-colors text-sm"
          title="Export to Excel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M5.884 6.68a.5.5 0 1 0-.768.64L7.349 10l-2.233 2.68a.5.5 0 0 0 .768.64L8 10.781l2.116 2.54a.5.5 0 0 0 .768-.641L8.651 10l2.233-2.68a.5.5 0 0 0-.768-.64L8 9.219l-2.116-2.54z"/>
            <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z"/>
          </svg>
          Export Excel
        </button>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th colSpan={2} className="px-4 py-2 border-b border-gray-200"></th>
              {customerIds.map(cid => (
                <th key={cid} colSpan={2} className="px-4 py-2 border-b border-l border-gray-200 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                  {customerMap.get(cid) || `Customer ${cid}`}
                </th>
              ))}
              <th colSpan={2} className="px-4 py-2 border-b border-l border-gray-200 text-center text-xs font-bold text-indigo-700 uppercase tracking-wider">
                Total
              </th>
            </tr>
            <tr>
              <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Part No</th>
              <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
              {customerIds.map(cid => (
                <React.Fragment key={cid}>
                  <th className="px-4 py-2 border-l border-gray-200 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Qty</th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                </React.Fragment>
              ))}
              <th className="px-4 py-2 border-l border-gray-200 text-right text-xs font-bold text-indigo-500 uppercase tracking-wider">Qty</th>
              <th className="px-4 py-2 text-right text-xs font-bold text-indigo-500 uppercase tracking-wider">Amount</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.length > 0 ? (
              rows.map(row => (
                <tr key={row.partNo} className="hover:bg-gray-50">
                  <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-800">{row.partNo}</td>
                  <td className="px-4 py-2 text-sm text-gray-600 max-w-xs truncate" title={row.description}>{row.description}</td>
                  {customerIds.map(cid => {
                    const data = row.customers[cid];
                    return (
                      <React.Fragment key={cid}>
                        <td className="px-4 py-2 border-l border-gray-100 whitespace-nowrap text-sm text-gray-700 text-right">
                          {data ? data.qty.toLocaleString('en-IN') : '-'}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 text-right">
                          {data ? data.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '-'}
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td className="px-4 py-2 border-l border-gray-200 whitespace-nowrap text-sm font-bold text-indigo-700 text-right">
                    {row.totalQty.toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm font-bold text-indigo-700 text-right">
                    {row.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2 + (customerIds.length * 2) + 2} className="px-4 py-8 text-center text-gray-500 text-sm">
                  No items found matching the filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
