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

    # 1. Remove blue color in Bill To (border-indigo-600, text-indigo-700)
    content = content.replace("border-indigo-600", "border-slate-400")
    content = content.replace("text-indigo-700", "text-slate-700")
    
    # 2. Quotation reference (text-indigo-600)
    content = content.replace("text-indigo-600", "text-slate-700")
    
    # Other indigo replacements for consistency (terms and conditions, etc)
    content = content.replace("border-indigo-100", "border-slate-300")
    content = content.replace("border-indigo-500", "border-slate-400")
    content = content.replace("bg-indigo-50/20", "bg-slate-100")
    content = content.replace("bg-indigo-50/5", "bg-slate-50")
    content = content.replace("bg-indigo-50/10", "bg-slate-50")
    content = content.replace("text-indigo-950", "text-slate-800")

    # 3. Stock Status remove boxes and keep dark grey
    stock_status_pattern = re.compile(
        r'<span className=\{`inline-block px-1\.5 py-0\.5 rounded text-\[9px\] font-bold \$\{item\.stockStatus === \'Stock\' \? \'bg-green-50 text-green-700 border border-green-200\' : \'bg-amber-50 text-amber-700 border border-amber-200\'\}`\}>'
    )
    content = stock_status_pattern.sub(
        r'<span className="text-[9px] font-extrabold text-slate-700">',
        content
    )

    # 4. Table Header make bolder (from user screenshot)
    # thead className="bg-slate-100 text-slate-700 ... "
    content = content.replace(
        'thead className="bg-slate-100 text-slate-700 border-b border-slate-300 uppercase tracking-wider text-[9px]"',
        'thead className="bg-slate-100 text-slate-900 font-extrabold border-b border-slate-400 uppercase tracking-wider text-[9px]"'
    )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Modifications complete.")
