
import React from 'react';
import type { Quotation, Customer, SalesPerson, PreparedBy } from '../types';
import { PREPARED_BY_LIST } from '../constants';
import { generateFormattedQuotationNumber } from '../utils/quotationNumber';
const LappLogo = () => (
    <img src="https://www.google.com/s2/favicons?domain=lapp.com&sz=128" alt="LAPP Logo" className="h-6 w-auto object-contain inline-block bg-white p-0.5 rounded shadow-sm border border-slate-100" />
);

const EatonLogo = () => (
    <img src="https://www.google.com/s2/favicons?domain=eaton.com&sz=128" alt="EATON Logo" className="h-6 w-auto object-contain inline-block bg-white p-0.5 rounded shadow-sm border border-slate-100" />
);

const PartexLogo = () => (
    <img src="https://www.google.com/s2/favicons?domain=partex.nu&sz=128" alt="PARTEX Logo" className="h-6 w-auto object-contain inline-block bg-white p-0.5 rounded shadow-sm border border-slate-100" />
);

interface QuotationPrintViewProps {
    quotation: Quotation;
    customer: Customer;
    salesPerson?: SalesPerson;
    logoUrl: string | null;
    allQuotations: Quotation[];
}

const numberToWords = (num: number): string => {
    if (num === 0) return 'Zero';
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const number = parseFloat(num.toFixed(2));
    const integerPart = Math.floor(number);
    if (integerPart > 999999999) return "Number too large";
    
    const toWords = (n: number): string => {
        let str = '';
        if (n >= 10000000) { str += toWords(Math.floor(n / 10000000)) + ' Crore '; n %= 10000000; }
        if (n >= 100000) { str += toWords(Math.floor(n / 100000)) + ' Lakh '; n %= 100000; }
        if (n >= 1000) { str += toWords(Math.floor(n / 1000)) + ' Thousand '; n %= 1000; }
        if (n >= 100) { str += toWords(Math.floor(n / 100)) + ' Hundred '; n %= 100; }
        if (n > 0) {
            if (str !== '') str += 'and ';
            if (n < 20) str += a[n];
            else { str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' : '') + a[n % 10]; }
        }
        return str.trim();
    };

    const words = toWords(integerPart);
    return `Rupees ${words.charAt(0).toUpperCase() + words.slice(1)} Only`;
}

const PREPARER_DESIGNATIONS: Record<PreparedBy, string> = {
    'Kumar': 'Sales Coordinator',
    'Vandita': 'Sales Coordinator',
    'Ranjan': 'Sales Coordinator',
};


export const QuotationPrintViewDiscounted: React.FC<QuotationPrintViewProps> = ({ quotation, allQuotations, customer, salesPerson, logoUrl }) => {
    const subTotal = (quotation.details || []).reduce((sum, item) => {
        const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
        return sum + (unitPrice * item.moq);
    }, 0);

    const gstAmount = quotation.gstAdded ? subTotal * 0.18 : 0;
    const grandTotal = subTotal + gstAmount;

    const preparerDesignation = PREPARER_DESIGNATIONS[quotation.preparedBy] || 'Authorised Signatory';

    const getPartNoLink = (partNo: string) => {
        if (quotation.productsBrand === 'Lapp' && partNo) {
            return `https://products.lappgroup.com/online-catalogue.html?q=${encodeURIComponent(partNo)}`;
        }
        return null;
    };

    return (
        <div className="bg-white p-6 md:p-8 font-sans text-[11px] text-slate-800 print-wrapper shadow-lg border border-slate-200 rounded-lg max-w-4xl mx-auto my-4">
            <div className="print-main-content">
                <header className="flex items-center justify-between pb-3 border-b-2 border-indigo-600 relative">
                    <div className="w-24 h-14 flex items-center justify-center shrink-0">
                         {logoUrl ? <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" /> : <div className="text-[9px] text-slate-400 border border-dashed border-slate-300 p-1 text-center rounded bg-slate-50">Logo</div>}
                    </div>
                    <div className="flex-1 text-center px-4">
                        <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">Siddhi Kabel Corporation Pvt Ltd</h1>
                        <p className="text-slate-600 text-[10px] mt-1.5 font-medium"># 3, 1st Main, 1st Block, B S K 3rd Stage, BENGALURU-560085.</p>
                        <p className="text-slate-500 text-[10px]">Tel: 080-26720440 / Mob: 9620000947 | E-Mail: <span className="text-indigo-600 font-semibold">info@siddhikabel.com</span></p>
                        <p className="text-slate-400 text-[9px] mt-0.5">CIN: U52100KA2008PTC047982 | GSTIN/UIN: 29AAMCS4385H1ZQ | State Name : Karnataka, Code: 29</p>
                    </div>
                    <div className="w-24 shrink-0"></div>
                </header>

                <div className="text-center my-3">
                    <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-widest border-b-2 border-indigo-100 pb-0.5 inline-block">QUOTATION</h2>
                </div>

                <section className="grid grid-cols-2 gap-6 my-4">
                    <div className="space-y-1 border-l-4 border-indigo-600 bg-slate-50/60 p-3 rounded-r-md shadow-sm">
                        <p className="font-bold text-indigo-700 text-[9px] uppercase tracking-wider">BILLED TO:</p>
                        <p className="font-extrabold text-xs text-slate-900 leading-tight">{customer.name}</p>
                        <p className="text-slate-600 leading-normal">{customer.address}</p>
                        <p className="text-slate-600 font-semibold">{customer.city} - {customer.pincode}</p>
                        <p className="text-slate-700 text-[10px] mt-1 pt-1 border-t border-slate-200/50">
                            <span className="font-semibold text-slate-500">Attn:</span> <span className="font-bold text-slate-800">{quotation.contactPerson}</span> ({quotation.contactNumber})
                        </p>
                    </div>
                    <div className="space-y-1 border-r-4 border-slate-700 bg-slate-50/60 p-3 rounded-l-md text-right shadow-sm flex flex-col justify-between">
                        <div>
                            <p className="font-bold text-slate-500 text-[9px] uppercase tracking-wider">Quotation Reference</p>
                            <p className="font-extrabold text-sm text-indigo-600 tracking-tight">{quotation.id > 0 ? generateFormattedQuotationNumber(quotation, allQuotations) : 'DRAFT'}</p>
                        </div>
                        <div className="text-[10px] text-slate-600 space-y-0.5 mt-2 pt-2 border-t border-slate-200/50">
                            <p><span className="font-semibold text-slate-500">Date:</span> <span className="font-bold text-slate-800">{new Date(quotation.quotationDate).toLocaleDateString('en-GB')}</span></p>
                            <p><span className="font-semibold text-slate-500">Enquiry Date:</span> {new Date(quotation.enquiryDate).toLocaleDateString('en-GB')}</p>
                        </div>
                    </div>
                </section>
                
                <div className="my-3 text-slate-700 text-[11px]">
                    <p className="font-semibold">Dear Sir / Madam,</p>
                    <p className="mt-0.5">Please find below our favourable offer for your requirement for <span className="font-bold text-indigo-700">{quotation.productsBrand}</span> Products.</p>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm my-3">
                    <table className="w-full text-left text-[10px] border-collapse">
                        <thead className="bg-slate-900 text-white uppercase tracking-wider text-[9px]">
                            <tr className="divide-x divide-slate-800">
                                <th className="p-2 font-bold text-center w-10">Sl. No</th>
                                <th className="p-2 font-bold">Part No</th>
                                <th className="p-2 font-bold w-1/4">Description</th>
                                <th className="p-2 font-bold text-center w-10">MOQ</th>
                                <th className="p-2 font-bold text-center w-10">REQ</th>
                                <th className="p-2 font-bold text-center w-10">UOM</th>
                                <th className="p-2 font-bold text-right w-16">List Price (₹)</th>
                                <th className="p-2 font-bold text-center w-14">Disc. %</th>
                                <th className="p-2 font-bold text-right w-16">Net Price (₹)</th>
                                <th className="p-2 font-bold text-right w-20">Amount (₹)</th>
                                <th className="p-2 font-bold text-center w-16">Stock Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {(quotation.details || []).map((item, index) => {
                                const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
                                const amount = unitPrice * item.moq;
                                const partNoUrl = getPartNoLink(item.partNo);
                                return (
                                    <tr key={index} className="divide-x divide-slate-200 hover:bg-slate-50/50 transition-colors odd:bg-slate-50/20">
                                        <td className="p-2 text-center text-slate-500 font-medium">{index + 1}</td>
                                        <td className="p-2 font-bold text-slate-900">
                                             {partNoUrl ? (
                                                <a href={partNoUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                                                    {item.partNo}
                                                </a>
                                            ) : (
                                                item.partNo
                                            )}
                                        </td>
                                        <td className="p-2 text-slate-700 leading-normal">{item.description}</td>
                                        <td className="p-2 text-center font-semibold text-slate-800">{item.moq}</td>
                                        <td className="p-2 text-center text-slate-600">{item.req}</td>
                                        <td className="p-2 text-center text-slate-600">{item.uom}</td>
                                        <td className="p-2 text-right text-slate-600">{item.price.toFixed(2)}</td>
                                        <td className="p-2 text-center font-semibold text-indigo-700 bg-indigo-50/10">{item.discount}%</td>
                                        <td className="p-2 text-right font-medium text-slate-800">{unitPrice.toFixed(2)}</td>
                                        <td className="p-2 text-right font-extrabold text-slate-900">{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="p-2 text-center">
                                            <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${item.stockStatus === 'Stock' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                                {item.stockStatus}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <section className="flex justify-end my-4">
                    <div className="w-80 space-y-1.5 border border-slate-200/80 p-3 rounded-lg bg-slate-50/40 shadow-sm">
                        <div className="flex justify-between text-[10px] text-slate-600">
                            <span className="font-semibold">{quotation.gstAdded ? 'Subtotal' : 'Total Amount'}</span>
                            <span className="font-bold">₹{subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        {quotation.gstAdded && (
                            <>
                                <div className="flex justify-between text-[10px] text-slate-600">
                                    <span className="font-semibold">GST 18%</span>
                                    <span className="font-bold">₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="h-px bg-slate-200 my-1"></div>
                                <div className="flex justify-between text-slate-900">
                                    <span className="font-bold text-xs">Grand Total</span>
                                    <span className="font-black text-sm text-indigo-700">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </>
                        )}
                        {!quotation.gstAdded && (
                            <>
                                <div className="h-px bg-slate-200 my-1"></div>
                                <div className="flex justify-between text-slate-900">
                                    <span className="font-bold text-xs">Total Amount</span>
                                    <span className="font-black text-sm text-indigo-700">₹{subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </>
                        )}
                    </div>
                </section>

                <div className="bg-slate-50 border border-slate-200/80 p-2.5 rounded-md my-3 font-semibold text-slate-700">
                    Amount in Words: <span className="text-slate-950 font-bold">{numberToWords(grandTotal)}</span>
                </div>

                <section className="border-l-4 border-indigo-500 bg-indigo-50/20 p-3.5 rounded-r-lg my-4 print-no-break shadow-sm">
                    <h3 className="font-extrabold text-indigo-950 mb-1.5 text-xs tracking-wider uppercase">Terms & Conditions:</h3>
                    <ol className="list-decimal list-inside space-y-1 text-slate-700 leading-relaxed text-[10px]">
                        <li><span className="font-semibold text-slate-900">Prices:</span> Ex Godown, Bangalore. (The Above Mentioned Price Is Net Disounted)</li>
                        <li><span className="font-semibold text-slate-900">Goods Service Tax:</span> {quotation.gstAdded ? 'GST 18% or As applicable at the time of Delivery' : 'GST Extra 18% or As GST % applicable at the time of Delivery.'}</li>
                        <li><span className="font-semibold text-slate-900">Delivery:</span> As Mentioned Above, Subject to Prior Sales.</li>
                        <li><span className="font-semibold text-slate-900">Freight:</span> Freight Extra Applicable.</li>
                        <li><span className="font-semibold text-slate-900">Payment terms:</span> {quotation.paymentTerms}</li>
                        <li><span className="font-semibold text-slate-900">Validity:</span> This Offer is Valid for One Week From the Date of Offer.</li>
                        <li><span className="font-semibold text-slate-900">Other terms:</span> {quotation.otherTerms}</li>
                        <li className="text-indigo-600 font-bold">Please click the Part No for material Spec and datasheet.</li>
                    </ol>
                </section>
                
                <div className="my-3 text-slate-600 leading-relaxed text-[11px]">
                    <p>Hope the above mentioned details are in line with your requirement, for any further clarification please feel free and contact us.</p>
                    <p className="mt-1 font-semibold text-slate-800">Thanking you,</p>
                </div>
            </div>

            {/* Signature Area (Prints at the end of content) */}
            <div className="mt-4 pt-3 flex justify-between items-end border-t border-slate-200 print-no-break">
                <p className="text-slate-400 text-[9px] italic">This is a computer-generated document.</p>
                <div className="text-center w-64">
                    <p className="font-bold text-slate-900">For Siddhi Kable Corporation Pvt Ltd,</p>
                    <div className="h-12 signature-space"></div>
                    <div className="border-t border-slate-300 pt-1.5">
                        <p className="font-bold text-slate-800">{quotation.preparedBy}</p>
                        <p className="text-slate-500 text-[10px]">({preparerDesignation})</p>
                    </div>
                </div>
            </div>

            {/* Running Footer (Repeated at bottom of pages during print) */}
            <footer className="running-footer">
                {/* Brand Logos (Left Side) */}
                <div className="flex items-center gap-2.5 shrink-0">
                    <LappLogo />
                    <EatonLogo />
                    <PartexLogo />
                </div>
                {/* Slogan (Center) */}
                <div className="text-center font-serif italic font-extrabold text-indigo-700 tracking-wide text-[10.5px]">
                    "Your Partner in Connectivity. Your Partner in Growth"
                </div>
                {/* Page Number (Right Side) */}
                <div className="text-slate-500 text-[10px] font-bold page-number shrink-0"></div>
            </footer>
        </div>
    );
};
