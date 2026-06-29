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

    # Remove font-[Cambria]
    content = content.replace('font-[Cambria] ', '')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Modifications complete.")
