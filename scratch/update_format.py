import os

components_dir = r"c:\offer Management\components"
files = [
    "QuotationPrintView.tsx",
    "QuotationPrintViewDiscounted.tsx",
    "QuotationPrintViewWithAirFreight.tsx"
]

for filename in files:
    filepath = os.path.join(components_dir, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Header thick black border
    content = content.replace(
        'className="flex items-center justify-between pb-3 border-b-2 border-slate-400 relative"',
        'className="flex items-center justify-between pb-3 border-b-[3px] border-slate-900 relative"'
    )

    # 2. Quotation Underline
    content = content.replace(
        'className="text-base font-extrabold text-slate-900 uppercase tracking-widest inline-block"',
        'className="text-base font-extrabold text-slate-900 uppercase tracking-widest inline-block underline underline-offset-4"'
    )

    # 3. Billed To Box
    content = content.replace(
        'className="space-y-1 border-l-4 border-slate-400 bg-slate-50/60 p-3 rounded-r-md shadow-sm"',
        'className="space-y-1 border border-slate-300 rounded-md p-3 bg-white"'
    )

    # 4. Quotation Reference Box (right side)
    content = content.replace(
        'className="space-y-1 border-r-4 border-slate-700 bg-slate-50/60 p-3 rounded-l-md text-right shadow-sm flex flex-col justify-between"',
        'className="space-y-1 border border-slate-300 rounded-md p-3 bg-white text-right flex flex-col justify-between"'
    )
    
    # Also change "Quotation Reference" text to "Quotation No:" to match image, and put on same line if possible, but keeping structure is fine
    content = content.replace(
        '<p className="font-bold text-slate-500 text-[9px] uppercase tracking-wider">Quotation Reference</p>',
        '' # We will integrate it below
    )
    content = content.replace(
        '<p className="font-extrabold text-sm text-slate-700 tracking-tight">{quotation.id > 0 ? generateFormattedQuotationNumber(quotation, allQuotations) : \'DRAFT\'}</p>',
        '<div className="flex justify-end gap-2 text-[10px]"><span className="font-semibold text-slate-600">Quotation No:</span> <span className="font-bold text-slate-900">{quotation.id > 0 ? generateFormattedQuotationNumber(quotation, allQuotations) : \'DRAFT\'}</span></div>'
    )
    
    # 5. Table Rows - remove alternating background
    content = content.replace(
        'className="divide-x divide-slate-200 hover:bg-slate-50/50 transition-colors odd:bg-slate-50/20"',
        'className="divide-x divide-slate-200 hover:bg-slate-50 transition-colors"'
    )

    # 6. Total Amount Box (change wrapper)
    content = content.replace(
        'className="w-80 space-y-1.5 border border-slate-200/80 p-3 rounded-lg bg-slate-50/40 shadow-sm"',
        'className="w-80 space-y-1.5 bg-slate-100 rounded-md p-2.5 px-4 font-bold"'
    )

    # 7. Amount in words (remove box)
    content = content.replace(
        '<div className="bg-slate-50 border border-slate-200/80 p-2.5 rounded-md my-1 font-semibold text-slate-700">\n                    Amount in Words: <span className="text-slate-950 font-bold">{numberToWords(grandTotal)}</span>\n                </div>',
        '<div className="my-2 text-slate-800 text-[11px] font-semibold">\n                    Amount in Words: <span className="text-slate-900 font-bold">{numberToWords(grandTotal)}</span>\n                </div>'
    )

    # 8. Terms & Conditions Box
    content = content.replace(
        'className="border-l-4 border-slate-400 bg-slate-100 p-3.5 rounded-r-lg mt-1 mb-3 print-no-break shadow-sm"',
        'className="border border-slate-300 rounded-md p-3 mb-3 print-no-break bg-white"'
    )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Modifications complete.")
