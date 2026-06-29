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

    # Remove the underline class
    content = content.replace(
        'className="text-base font-extrabold text-slate-900 uppercase tracking-widest border-b-2 border-slate-300 pb-0.5 inline-block"',
        'className="text-base font-extrabold text-slate-900 uppercase tracking-widest inline-block"'
    )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Modifications complete.")
