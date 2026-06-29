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

    # Define the old header
    old_header = """<div className="flex-1 text-center px-4">
                        <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">Siddhi Kabel Corporation Pvt Ltd</h1>
                        <p className="text-slate-600 text-[10px] mt-1.5 font-medium"># 3, 1st Main, 1st Block, B S K 3rd Stage, BENGALURU-560085.</p>
                        <p className="text-slate-500 text-[10px]">Tel: 080-26720440 / Mob: 9620000947 | E-Mail: <span className="text-slate-700 font-semibold">info@siddhikabel.com</span></p>
                        <p className="text-slate-400 text-[9px] mt-0.5">CIN: U52100KA2008PTC047982 | GSTIN/UIN: 29AAMCS4385H1ZQ | State Name : Karnataka, Code: 29</p>
                    </div>"""

    # Define the new header (unified grey colors and sizes, matching screenshot)
    new_header = """<div className="flex-1 text-center px-4">
                        <h1 className="text-xl font-bold text-[#1e3a8a] uppercase tracking-tight leading-none mb-1">SIDDHI KABEL CORPORATION PVT LTD</h1>
                        <p className="text-slate-600 text-[10px]"># 3, 1st Main, 1st Block, B S K 3rd Stage, BENGALURU-560085.</p>
                        <p className="text-slate-600 text-[10px]">Tel: 080-26720440 / Mob: 9620000947 | E-Mail: info@siddhikabel.com</p>
                        <p className="text-slate-600 text-[10px]">CIN: U52100KA2008PTC047982 | GSTIN/UIN: 29AAMCS4385H1ZQ | State Name : Karnataka, Code: 29</p>
                    </div>"""

    content = content.replace(old_header, new_header)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Modifications complete.")
