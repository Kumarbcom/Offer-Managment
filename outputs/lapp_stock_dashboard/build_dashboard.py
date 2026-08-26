import json
import math
import re
from datetime import datetime
from pathlib import Path

import pandas as pd


SOURCE = Path(r"C:\Users\DELL\Desktop\Lapp Stock Analysis.xlsx")
OUT = Path(r"C:\offer Management\outputs\lapp_stock_dashboard\lapp_stock_dashboard.html")


def clean_text(value):
    if pd.isna(value):
        return ""
    return str(value).replace("_x000D_", " ").replace("\r", " ").replace("\n", " ").strip()


def product_code(value):
    text = clean_text(value)
    if not text:
        return ""
    return re.split(r"\s*\(", text, maxsplit=1)[0].strip()


def round_nearest_10(value):
    if not value or pd.isna(value):
        return 0
    return int(round(float(value) / 10.0) * 10)


def number(value):
    if pd.isna(value):
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def parse_date_label(value):
    text = clean_text(value)
    match = re.search(r"For\s+(.+)$", text, re.I)
    if not match:
        return None
    return datetime.strptime(match.group(1), "%d-%b-%y").date()


def load_lapp_movements():
    raw = pd.read_excel(SOURCE, sheet_name="LAPP", header=None)
    date_blocks = []
    for col in range(raw.shape[1]):
        dt = parse_date_label(raw.iat[2, col])
        if dt:
            date_blocks.append((dt, col))

    movements = {}
    for row in range(5, raw.shape[0]):
        part = product_code(raw.iat[row, 0])
        if not part:
            continue
        day_map = {}
        for dt, col in date_blocks:
            inward = number(raw.iat[row, col])
            outward = number(raw.iat[row, col + 3]) if col + 3 < raw.shape[1] else 0
            day_map[dt.isoformat()] = {"inward": inward, "outward": outward}
        movements[part] = day_map
    return [dt.isoformat() for dt, _ in date_blocks], movements


def main():
    material = pd.read_excel(SOURCE, sheet_name="Material Master")
    material["code"] = material["Part No"].map(product_code)
    material["Make"] = material["Make"].map(clean_text)
    material["Material Group"] = material["Material Group"].map(clean_text)
    material["Description"] = material["Description"].map(clean_text)
    lapp_material = material[material["Make"].str.upper().eq("LAPP")].drop_duplicates("code")

    opening = pd.read_excel(SOURCE, sheet_name="Opening Stock", header=1)
    opening["code"] = opening["Particulars"].map(product_code)
    opening_qty = opening.groupby("code")["Quantity"].sum().map(number).to_dict()

    sales = pd.read_excel(SOURCE, sheet_name="Sales Report From Apr-2025 ")
    sales["Date"] = pd.to_datetime(sales["Date"], errors="coerce")
    sales["code"] = sales["Particulars"].map(product_code)
    sales["Quantity"] = pd.to_numeric(sales["Quantity"], errors="coerce").fillna(0)
    lapp_codes = set(lapp_material["code"])
    sales = sales[sales["code"].isin(lapp_codes)]

    fy_start = pd.Timestamp("2025-04-01")
    fy_end = pd.Timestamp("2026-03-31")
    recent_start = pd.Timestamp("2026-04-01")
    recent_end = pd.Timestamp("2026-07-31")
    fy_sales = sales[(sales["Date"] >= fy_start) & (sales["Date"] <= fy_end)]
    recent_sales = sales[(sales["Date"] >= recent_start) & (sales["Date"] <= recent_end)]
    fy_qty = fy_sales.groupby("code")["Quantity"].sum().to_dict()
    recent_qty = recent_sales.groupby("code")["Quantity"].sum().to_dict()

    movement_dates, movements = load_lapp_movements()

    records = []
    total_opening = total_inward = total_outward = total_closing = 0.0
    active_codes = set(lapp_material["code"]) | set(movements) | set(fy_qty) | set(recent_qty)
    material_lookup = lapp_material.set_index("code").to_dict("index")

    for code in sorted(active_codes):
        meta = material_lookup.get(code, {})
        opening_stock = number(opening_qty.get(code, 0))
        avg_fy = number(fy_qty.get(code, 0)) / 12.0
        avg_4 = number(recent_qty.get(code, 0)) / 4.0
        if avg_fy:
            trend_pct = ((avg_4 - avg_fy) / avg_fy) * 100
        elif avg_4:
            trend_pct = 100.0
        else:
            trend_pct = 0.0

        closing = opening_stock
        daily = []
        for dt in movement_dates:
            mv = movements.get(code, {}).get(dt, {"inward": 0, "outward": 0})
            closing += mv["inward"] - mv["outward"]
            daily.append({
                "date": dt,
                "inward": round(mv["inward"], 2),
                "outward": round(mv["outward"], 2),
                "closing": round(closing, 2),
            })

        inward_total = sum(x["inward"] for x in daily)
        outward_total = sum(x["outward"] for x in daily)
        total_opening += opening_stock
        total_inward += inward_total
        total_outward += outward_total
        total_closing += closing

        records.append({
            "code": code,
            "make": clean_text(meta.get("Make", "LAPP")) or "LAPP",
            "makeGroup": clean_text(meta.get("Material Group", "")),
            "description": clean_text(meta.get("Description", code)),
            "opening": round(opening_stock, 2),
            "avgFY": round(avg_fy, 2),
            "avg4": round(avg_4, 2),
            "trendPct": round(trend_pct, 1),
            "maxStock": round_nearest_10(avg_fy * 2),
            "reorderLevel": round_nearest_10(avg_fy * 1.5),
            "minStock": round_nearest_10(avg_fy),
            "inwardTotal": round(inward_total, 2),
            "outwardTotal": round(outward_total, 2),
            "closing": round(closing, 2),
            "daily": daily,
        })

    records.sort(key=lambda x: (x["closing"] <= 0, -x["outwardTotal"], x["code"]))
    payload = {
        "generatedAt": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "source": str(SOURCE),
        "periods": {
            "avgFY": "Apr-2025 to Mar-2026",
            "avg4": "Apr-2026 to Jul-2026",
            "movements": "01-Apr-2026 to 30-Apr-2026",
        },
        "summary": {
            "items": len(records),
            "opening": round(total_opening, 2),
            "inward": round(total_inward, 2),
            "outward": round(total_outward, 2),
            "closing": round(total_closing, 2),
            "up": sum(1 for r in records if r["trendPct"] > 0),
            "down": sum(1 for r in records if r["trendPct"] < 0),
        },
        "records": records,
    }

    html = build_html(payload)
    OUT.write_text(html, encoding="utf-8")
    print(OUT)
    print(json.dumps(payload["summary"], indent=2))


def build_html(payload):
    data = json.dumps(payload, ensure_ascii=False)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LAPP Stock Planning Dashboard</title>
<style>
:root {{
  --ink: #172026;
  --muted: #64717d;
  --line: #d9e1e8;
  --panel: #ffffff;
  --page: #f4f7f9;
  --accent: #0f6f68;
  --accent-2: #b7791f;
  --good: #16803c;
  --bad: #c93535;
  --warn: #9a5b00;
}}
* {{ box-sizing: border-box; }}
body {{ margin: 0; font-family: Arial, Helvetica, sans-serif; color: var(--ink); background: var(--page); }}
header {{ background: #ffffff; border-bottom: 1px solid var(--line); padding: 18px 24px; position: sticky; top: 0; z-index: 5; }}
h1 {{ margin: 0 0 5px; font-size: 24px; letter-spacing: 0; }}
.sub {{ color: var(--muted); font-size: 13px; }}
main {{ padding: 18px 24px 32px; }}
.cards {{ display: grid; grid-template-columns: repeat(5, minmax(140px, 1fr)); gap: 12px; margin-bottom: 16px; }}
.card {{ background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 14px; min-height: 82px; }}
.label {{ color: var(--muted); font-size: 12px; text-transform: uppercase; }}
.value {{ margin-top: 8px; font-size: 22px; font-weight: 700; }}
.toolbar {{ display: grid; grid-template-columns: minmax(220px, 1fr) 180px 180px 180px; gap: 10px; margin-bottom: 12px; align-items: center; }}
input, select {{ width: 100%; border: 1px solid var(--line); border-radius: 6px; padding: 10px; font-size: 14px; background: #fff; color: var(--ink); }}
.table-wrap {{ background: var(--panel); border: 1px solid var(--line); border-radius: 8px; overflow: auto; max-height: calc(100vh - 255px); }}
table {{ border-collapse: separate; border-spacing: 0; width: 100%; min-width: 1900px; font-size: 12px; }}
th, td {{ padding: 8px 10px; border-bottom: 1px solid var(--line); border-right: 1px solid #edf1f4; white-space: nowrap; vertical-align: top; }}
th {{ position: sticky; top: 0; background: #eaf0f3; z-index: 2; text-align: left; font-weight: 700; cursor: pointer; }}
tbody tr:hover {{ background: #f8fbfc; }}
.num {{ text-align: right; font-variant-numeric: tabular-nums; }}
.desc {{ max-width: 340px; white-space: normal; line-height: 1.25; }}
.trend-up {{ color: var(--good); font-weight: 700; }}
.trend-down {{ color: var(--bad); font-weight: 700; }}
.trend-flat {{ color: var(--muted); font-weight: 700; }}
.low {{ color: var(--bad); font-weight: 700; }}
.ok {{ color: var(--good); font-weight: 700; }}
.pill {{ display: inline-block; padding: 3px 7px; border-radius: 999px; background: #eef3f5; }}
.foot {{ color: var(--muted); font-size: 12px; margin-top: 10px; }}
@media (max-width: 900px) {{
  header, main {{ padding-left: 14px; padding-right: 14px; }}
  .cards {{ grid-template-columns: repeat(2, 1fr); }}
  .toolbar {{ grid-template-columns: 1fr; }}
  .table-wrap {{ max-height: none; }}
}}
</style>
</head>
<body>
<header>
  <h1>LAPP Stock Planning Dashboard</h1>
  <div class="sub">Source: {payload["source"]} | Generated: {payload["generatedAt"]} | Avg Last FY: {payload["periods"]["avgFY"]} | Avg Last 4 Months: {payload["periods"]["avg4"]}</div>
</header>
<main>
  <section class="cards" id="cards"></section>
  <section class="toolbar">
    <input id="search" type="search" placeholder="Search part, make group, description">
    <select id="trendFilter">
      <option value="all">All trends</option>
      <option value="up">Increasing sales</option>
      <option value="down">Decreasing sales</option>
      <option value="flat">Flat / no sales</option>
    </select>
    <select id="stockFilter">
      <option value="all">All stock status</option>
      <option value="belowMin">Below min stock</option>
      <option value="belowReorder">Below reorder level</option>
      <option value="aboveMax">Above max stock</option>
    </select>
    <select id="limit">
      <option value="250">Show 250 rows</option>
      <option value="500">Show 500 rows</option>
      <option value="1000">Show 1000 rows</option>
      <option value="999999">Show all rows</option>
    </select>
  </section>
  <section class="table-wrap">
    <table id="grid"></table>
  </section>
  <div class="foot">Stock Planning: Max Stock = Avg Last FY x 2, Reorder Level = Avg Last FY x 1.5, Min Stock = Avg Last FY. Planning quantities are rounded to the nearest 10.</div>
</main>
<script>
const payload = {data};
let rows = payload.records.slice();
let sortKey = "outwardTotal";
let sortDir = -1;
const fmt = new Intl.NumberFormat("en-IN", {{ maximumFractionDigits: 1 }});
const fmt0 = new Intl.NumberFormat("en-IN", {{ maximumFractionDigits: 0 }});

function card(label, value) {{
  return `<div class="card"><div class="label">${{label}}</div><div class="value">${{value}}</div></div>`;
}}

function renderCards() {{
  const s = payload.summary;
  document.getElementById("cards").innerHTML = [
    card("LAPP Products", fmt0.format(s.items)),
    card("Opening Stock", fmt.format(s.opening)),
    card("April Inward", fmt.format(s.inward)),
    card("April Outward", fmt.format(s.outward)),
    card("April Closing", fmt.format(s.closing))
  ].join("");
}}

function trendCell(v) {{
  if (v > 0) return `<span class="trend-up">&uarr; ${{fmt.format(Math.abs(v))}}%</span>`;
  if (v < 0) return `<span class="trend-down">&darr; ${{fmt.format(Math.abs(v))}}%</span>`;
  return `<span class="trend-flat">0%</span>`;
}}

function stockClass(row) {{
  if (row.closing < row.minStock) return "low";
  if (row.closing >= row.minStock && row.closing <= row.maxStock) return "ok";
  return "";
}}

function applyFilters() {{
  const q = document.getElementById("search").value.trim().toLowerCase();
  const trend = document.getElementById("trendFilter").value;
  const stock = document.getElementById("stockFilter").value;
  rows = payload.records.filter(r => {{
    const text = `${{r.code}} ${{r.makeGroup}} ${{r.description}}`.toLowerCase();
    if (q && !text.includes(q)) return false;
    if (trend === "up" && r.trendPct <= 0) return false;
    if (trend === "down" && r.trendPct >= 0) return false;
    if (trend === "flat" && r.trendPct !== 0) return false;
    if (stock === "belowMin" && r.closing >= r.minStock) return false;
    if (stock === "belowReorder" && r.closing >= r.reorderLevel) return false;
    if (stock === "aboveMax" && r.closing <= r.maxStock) return false;
    return true;
  }});
  sortRows();
}}

function sortRows() {{
  rows.sort((a, b) => {{
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === "string") return av.localeCompare(bv) * sortDir;
    return ((av || 0) - (bv || 0)) * sortDir;
  }});
  renderTable();
}}

function renderTable() {{
  const limit = Number(document.getElementById("limit").value);
  const shown = rows.slice(0, limit);
  const dayHeaders = payload.records[0]?.daily.map(d => `<th class="num">${{d.date.slice(8,10)}} Apr Closing</th>`).join("") || "";
  const headers = [
    ["code", "Part No"], ["make", "Make"], ["makeGroup", "Make Group"], ["description", "Description"],
    ["opening", "Opening Stock"], ["avgFY", "Avg. Last FY"], ["avg4", "Avg. Last 4 Months"], ["trendPct", "Trend"],
    ["maxStock", "Max Stock"], ["reorderLevel", "Reorder Level"], ["minStock", "Min Stock"],
    ["inwardTotal", "April Inward"], ["outwardTotal", "April Outward"], ["closing", "April Closing"]
  ].map(([k, h]) => `<th data-key="${{k}}">${{h}}</th>`).join("");
  const body = shown.map(r => {{
    const daily = r.daily.map(d => `<td class="num">${{fmt.format(d.closing)}}</td>`).join("");
    return `<tr>
      <td>${{r.code}}</td><td>${{r.make}}</td><td>${{r.makeGroup}}</td><td class="desc">${{r.description}}</td>
      <td class="num">${{fmt.format(r.opening)}}</td><td class="num">${{fmt.format(r.avgFY)}}</td><td class="num">${{fmt.format(r.avg4)}}</td><td class="num">${{trendCell(r.trendPct)}}</td>
      <td class="num">${{fmt0.format(r.maxStock)}}</td><td class="num">${{fmt0.format(r.reorderLevel)}}</td><td class="num">${{fmt0.format(r.minStock)}}</td>
      <td class="num">${{fmt.format(r.inwardTotal)}}</td><td class="num">${{fmt.format(r.outwardTotal)}}</td><td class="num ${{stockClass(r)}}">${{fmt.format(r.closing)}}</td>
      ${{daily}}
    </tr>`;
  }}).join("");
  document.getElementById("grid").innerHTML = `<thead><tr>${{headers}}${{dayHeaders}}</tr></thead><tbody>${{body}}</tbody>`;
  document.querySelectorAll("th[data-key]").forEach(th => th.addEventListener("click", () => {{
    const key = th.dataset.key;
    if (sortKey === key) sortDir *= -1; else {{ sortKey = key; sortDir = 1; }}
    sortRows();
  }}));
}}

["search", "trendFilter", "stockFilter", "limit"].forEach(id => document.getElementById(id).addEventListener("input", applyFilters));
renderCards();
applyFilters();
</script>
</body>
</html>"""


if __name__ == "__main__":
    main()
