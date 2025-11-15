
import React from 'react';
import type { Quotation, Customer, SalesPerson } from '../types';

interface QuotationPrintViewProps {
    quotation: Quotation;
    customer: Customer;
    salesPerson?: SalesPerson;
}

export const QuotationPrintViewWithAirFreight: React.FC<QuotationPrintViewProps> = ({ quotation, customer, salesPerson }) => {
    const totals = quotation.details.reduce((acc, item) => {
        const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
        const amount = unitPrice * item.moq;
        const freightAmount = item.airFreight ? (item.airFreightDetails.weightPerMtr / 1000 * 150) * item.moq : 0;
        
        acc.totalAmount += amount;
        acc.totalFreight += freightAmount;
        return acc;
    }, { totalAmount: 0, totalFreight: 0 });

    return (
        <div className="bg-white p-8 font-sans text-xs text-black print-container">
            <div className="text-center mb-4 border-b-2 border-black pb-2">
                <h1 className="text-2xl font-bold">Siddhi Kable Corporation Pvt Ltd</h1>
                <p>#35/1, 2nd Floor, Middle School Road, V.V. Puram, Bengaluru - 560 004</p>
                <p>Phone: 080 - 41221123 / 41221124 | Email: info@siddhikable.com</p>
                <p>GSTIN: 29AAFCS8333L1ZJ</p>
                <h2 className="text-xl font-bold mt-2 underline">QUOTATION WITH AIR FREIGHT</h2>
            </div>

            <div className="flex justify-between mb-4">
                <div>
                    <p><span className="font-bold">To:</span> {customer.name}</p>
                    <p>{customer.address}</p>
                    <p>{customer.city} - {customer.pincode}</p>
                    <p><span className="font-bold">Kind Attn:</span> {quotation.contactPerson}</p>
                </div>
                <div className="text-right">
                    <p><span className="font-bold">Quotation No:</span> SKC/QTN/{quotation.id}</p>
                    <p><span className="font-bold">Date:</span> {new Date(quotation.quotationDate).toLocaleDateString('en-GB')}</p>
                </div>
            </div>

            <table className="w-full border-collapse border border-black mb-4">
                <thead>
                    <tr className="bg-gray-200">
                        <th className="border border-black p-1">Sl. No</th>
                        <th className="border border-black p-1">Part No</th>
                        <th className="border border-black p-1">Description</th>
                        <th className="border border-black p-1">Qty</th>
                        <th className="border border-black p-1">Unit Price (₹)</th>
                        <th className="border border-black p-1">Amount (₹)</th>
                        <th className="border border-black p-1">Air Freight (₹)</th>
                        <th className="border border-black p-1">Total (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    {quotation.details.map((item, index) => {
                        const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
                        const amount = unitPrice * item.moq;
                        const freightAmount = item.airFreight ? (item.airFreightDetails.weightPerMtr / 1000 * 150) * item.moq : 0;
                        const totalWithFreight = amount + freightAmount;
                        return (
                            <tr key={index}>
                                <td className="border border-black p-1 text-center">{index + 1}</td>
                                <td className="border border-black p-1">{item.partNo}</td>
                                <td className="border border-black p-1">{item.description}</td>
                                <td className="border border-black p-1 text-center">{item.moq} {item.uom}</td>
                                <td className="border border-black p-1 text-right">{unitPrice.toFixed(2)}</td>
                                <td className="border border-black p-1 text-right">{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="border border-black p-1 text-right">{freightAmount > 0 ? freightAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                                <td className="border border-black p-1 text-right font-bold">{totalWithFreight.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr className="font-bold">
                        <td colSpan={5} className="border border-black p-1 text-right">Grand Total</td>
                        <td className="border border-black p-1 text-right">{totals.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="border border-black p-1 text-right">{totals.totalFreight.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="border border-black p-1 text-right">{(totals.totalAmount + totals.totalFreight).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                </tfoot>
            </table>

            <div className="border border-black p-2">
                <h3 className="font-bold underline mb-2">Terms & Conditions:</h3>
                <ol className="list-decimal list-inside space-y-1">
                    <li><span className="font-bold">GST:</span> Extra at 18%</li>
                    <li><span className="font-bold">Delivery:</span> As mentioned in quotation</li>
                    <li><span className="font-bold">Payment:</span> {quotation.paymentTerms}</li>
                    <li><span className="font-bold">Validity:</span> 30 Days</li>
                </ol>
            </div>

            <div className="mt-8 flex justify-between items-end">
                <div><p>Thanking you and assuring you of our best services at all times.</p></div>
                <div className="text-center"><p className="font-bold">For Siddhi Kable Corporation Pvt Ltd,</p><div className="h-16"></div><p>({quotation.preparedBy})</p></div>
            </div>
        </div>
    );
};
