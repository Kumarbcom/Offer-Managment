import os
import re

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

    # 1. Adjust Column Widths
    content = content.replace('className="p-2 font-bold w-1/3"', 'className="p-2 font-bold w-auto"')
    content = content.replace('className="p-2 font-bold text-center w-20"', 'className="p-2 font-bold text-center w-28"')

    # 2. Unify table data font weights
    # Remove font-bold text-slate-900 for Part No
    content = content.replace('className="p-2 font-bold text-slate-900"', 'className="p-2 text-slate-700"')
    
    # Remove leading-normal for Description
    content = content.replace('className="p-2 text-slate-700 leading-normal"', 'className="p-2 text-slate-700"')
    
    # Remove font-semibold for MOQ
    content = content.replace('className="p-2 text-center font-semibold text-slate-800"', 'className="p-2 text-center text-slate-700"')
    
    # UOM/REQ is already text-slate-600, make it slate-700
    content = content.replace('className="p-2 text-center text-slate-600"', 'className="p-2 text-center text-slate-700"')
    
    # Unit price font-medium text-slate-800
    content = content.replace('className="p-2 text-right font-medium text-slate-800"', 'className="p-2 text-right text-slate-700"')
    
    # Amount font-extrabold text-slate-900
    content = content.replace('className="p-2 text-right font-extrabold text-slate-900"', 'className="p-2 text-right text-slate-700"')
    
    # Stock status font-extrabold
    content = content.replace('className="text-[9px] font-extrabold text-slate-700"', 'className="text-[9px] text-slate-700"')
    
    # Amount in words font-bold
    content = content.replace(
        '<div className="my-2 text-slate-800 text-[11px] font-semibold">\n                    Amount in Words: <span className="text-slate-900 font-bold">{numberToWords(grandTotal)}</span>\n                </div>',
        '<div className="my-2 text-slate-800 text-[11px] font-bold">\n                    Amount in Words: {numberToWords(grandTotal)}\n                </div>'
    )
    
    # In Air Freight, totalWithFreight has font-extrabold text-slate-900
    content = content.replace('className="p-2 text-right font-extrabold text-slate-900"', 'className="p-2 text-right text-slate-700"')
    
    # In Discounted, price has text-slate-600
    content = content.replace('className="p-2 text-right text-slate-600"', 'className="p-2 text-right text-slate-700"')
    # Discount has font-semibold text-slate-700 bg-slate-50
    content = content.replace('className="p-2 text-center font-semibold text-slate-700 bg-slate-50"', 'className="p-2 text-center text-slate-700 bg-slate-50"')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Modifications complete.")
