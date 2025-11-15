
import React from 'react';
import type { Quotation, Customer, SalesPerson } from '../types';

interface QuotationPrintViewProps {
    quotation: Quotation;
    customer: Customer;
    salesPerson?: SalesPerson;
}

export const QuotationPrintViewDiscounted: React.FC<QuotationPrintViewProps> = ({ quotation, customer, salesPerson }) => {
    const totalAmount = quotation.details.reduce((sum, item) => {
        const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
        return sum + (unitPrice * item.moq);
    }, 0);
    
    const numberToWords = (num: number): string => {
        if (num === 0) return 'Zero';
        const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        const number = parseFloat(num.toFixed(2));
        const integerPart = Math.floor(number);
        if (integerPart > 9999999) return "Number too large";
        
        const toWords = (n: number): string => {
            let str = '';
            if (n >= 100000) { str += toWords(Math.floor(n / 100000)) + ' Lakh '; n %= 100000; }
            if (n >= 1000) { str += toWords(Math.floor(n / 1000)) + ' Thousand '; n %= 1000; }
            if (n >= 100) { str += toWords(Math.floor(n / 100)) + ' Hundred '; n %= 100; }
            if (n > 0) {
                if (str !== '') str += 'and ';
                if (n < 20) str += a[n];
                else { str += b[Math.floor(n / 10)] + ' ' + a[n % 10]; }
            }
            return str.trim();
        };
        return `Rupees ${toWords(integerPart)} Only`;
    }

    return (
        <div className="bg-white p-8 font-sans text-xs text-black print-container">
            <div className="text-center mb-4 border-b-2 border-black pb-2">
                <h1 className="text-2xl font-bold">Siddhi Kable Corporation Pvt Ltd</h1>
                <p>#35/1, 2nd Floor, Middle School Road, V.V. Puram, Bengaluru - 560 004</p>
                <p>Phone: 080 - 41221123 / 41221124 | Email: info@siddhikable.com</p>
                <p>GSTIN: 29AAFCS8333L1ZJ</p>
                <h2 className="text-xl font-bold mt-2 underline">QUOTATION</h2>
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

            <p className="mb-4"><span className="font-bold">Subject:</span> Quotation for {quotation.productsBrand} make Cables & Accessories</p>

            <table className="w-full border-collapse border border-black mb-4">
                <thead>
                    <tr className="bg-gray-200">
                        <th className="border border-black p-1">Sl. No</th>
                        <th className="border border-black p-1">Part No</th>
                        <th className="border border-black p-1">Description</th>
                        <th className="border border-black p-1">Qty</th>
                        <th className="border border-black p-1">List Price (₹)</th>
                        <th className="border border-black p-1">Disc. %</th>
                        <th className="border border-black p-1">Net Price (₹)</th>
                        <th className="border border-black p-1">Amount (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    {quotation.details.map((item, index) => {
                        const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
                        const amount = unitPrice * item.moq;
                        return (
                            <tr key={index}>
                                <td className="border border-black p-1 text-center">{index + 1}</td>
                                <td className="border border-black p-1">{item.partNo}</td>
                                <td className="border border-black p-1">{item.description}</td>
                                <td className="border border-black p-1 text-center">{item.moq} {item.uom}</td>
                                <td className="border border-black p-1 text-right">{item.price.toFixed(2)}</td>
                                <td className="border border-black p-1 text-center">{item.discount}%</td>
                                <td className="border border-black p-1 text-right">{unitPrice.toFixed(2)}</td>
                                <td className="border border-black p-1 text-right">{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr className="font-bold">
                        <td colSpan={7} className="border border-black p-1 text-right">Total Amount</td>
                        <td className="border border-black p-1 text-right">{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                </tfoot>
            </table>
            
            <p className="font-bold mb-4">Amount in Words: {numberToWords(totalAmount)}</p>

            <div className="border border-black p-2">
                <h3 className="font-bold underline mb-2">Terms & Conditions:</h3>
                <ol className="list-decimal list-inside space-y-1">
                    <li><span className="font-bold">GST:</span> Extra at 18%</li>
                    <li><span className="font-bold">Delivery:</span> {quotation.details.map(d => d.stockStatus).join(', ')}</li>
                    <li><span className="font-bold">Freight:</span> Extra at actuals</li>
                    <li><span className="font-bold">Payment:</span> {quotation.paymentTerms}</li>
                    <li><span className="font-bold">Validity:</span> 30 Days</li>
                    <li><span className="font-bold">Other Terms:</span> {quotation.otherTerms}</li>
                </ol>
            </div>

            <div className="mt-8 flex justify-between items-end">
                <div><p>Thanking you and assuring you of our best services at all times.</p></div>
                <div className="text-center"><p className="font-bold">For Siddhi Kable Corporation Pvt Ltd,</p><div className="h-16"></div><p>({quotation.preparedBy})</p></div>
            </div>
        </div>
    );
};
