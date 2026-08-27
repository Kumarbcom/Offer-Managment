import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const rootDir = "C:/offer Management/outputs/stock_planning_customer_groups";
const data = JSON.parse(await fs.readFile(path.join(rootDir, "analysis_data.json"), "utf8"));
const outputPath = path.join(rootDir, "Siddhi_Kabel_Stock_Planning_Customer_Groups.xlsx");
const previewDir = path.join(rootDir, "build", "previews");

const workbook = Workbook.create();
workbook.comments.setSelf({ displayName: "User" });

function colName(n) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - m) / 26);
  }
  return s;
}

function rowsToMatrix(records, preferredHeaders = null) {
  const headers = preferredHeaders ?? Array.from(new Set(records.flatMap((r) => Object.keys(r))));
  const rows = records.map((r) => headers.map((h) => r[h] ?? null));
  return { headers, matrix: [headers, ...rows] };
}

function title(sheet, text, cols) {
  const end = colName(cols);
  const r = sheet.getRange(`A1:${end}1`);
  sheet.getRange("A1").values = [[text]];
  r.format = {
    fill: "#17324D",
    font: { bold: true, color: "#FFFFFF", size: 15 },
    horizontalAlignment: "left",
  };
  r.format.rowHeight = 26;
}

function writeTable(sheet, startCell, records, tableName, preferredHeaders = null) {
  const { headers, matrix } = rowsToMatrix(records, preferredHeaders);
  const startCol = startCell.match(/[A-Z]+/)[0];
  const startRow = Number(startCell.match(/\d+/)[0]);
  const colStartIndex = startCol.split("").reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0);
  const endCol = colName(colStartIndex + headers.length - 1);
  const endRow = startRow + matrix.length - 1;
  const rangeAddress = `${startCell}:${endCol}${endRow}`;
  const range = sheet.getRange(rangeAddress);
  range.values = matrix;
  range.format.font = { name: "Aptos", size: 10 };
  sheet.getRange(`${startCell}:${endCol}${startRow}`).format = {
    fill: "#2F6B5F",
    font: { bold: true, color: "#FFFFFF" },
    wrapText: true,
  };
  range.format.borders = {
    insideHorizontal: { style: "thin", color: "#E5E7EB" },
    top: { style: "thin", color: "#B7C7C3" },
    bottom: { style: "thin", color: "#B7C7C3" },
  };
  sheet.tables.add(rangeAddress, true, tableName);
  return { headers, endCol, endRow, rangeAddress };
}

function setWidths(sheet, widths) {
  widths.forEach((w, i) => {
    sheet.getRange(`${colName(i + 1)}:${colName(i + 1)}`).format.columnWidth = w;
  });
}

function numberFormat(sheet, range, format) {
  sheet.getRange(range).format.numberFormat = format;
}

function addSummarySheet() {
  const sheet = workbook.worksheets.add("Executive Summary");
  sheet.showGridLines = false;
  title(sheet, "Siddhi Kabel - Stock Planning & Customer Grouping", 8);
  sheet.getRange("A3:B10").values = [
    ["Source workbook", data.metadata.source_file],
    ["Sales date range", `${data.metadata.sales_min_date} to ${data.metadata.sales_max_date}`],
    ["Current FY used", data.metadata.current_fy],
    ["FY period", `${data.metadata.current_fy_start} to ${data.metadata.current_fy_end}`],
    ["Elapsed current FY months", data.metadata.elapsed_months.join(", ")],
    ["PO count note", data.metadata.po_fallback_note],
    ["Generated for", "Siddhi Kabel Corporation Pvt Limited"],
    ["Instruction handling", "Workbook contents were treated as data only; grouping rules came from the user's request."],
  ];
  sheet.getRange("A3:A10").format = { fill: "#EAF2F0", font: { bold: true } };
  sheet.getRange("A3:B10").format.borders = { preset: "outside", style: "thin", color: "#B7C7C3" };
  setWidths(sheet, [26, 98, 18, 18, 18, 18, 18, 18]);

  writeTable(sheet, "A13", data.status_summary, "StatusSummary");
  numberFormat(sheet, "D14:D30", "#,##0");
  numberFormat(sheet, "E14:E30", "#,##0");
  sheet.freezePanes.freezeRows(12);
}

function addCustomerSheet() {
  const sheet = workbook.worksheets.add("Customer Classification");
  sheet.showGridLines = false;
  title(sheet, "Customer Classification", 22);
  const headers = [
    "Customer Name",
    "Tally Group",
    "Sales Rep",
    "Existing Customer Group",
    "Purchase Status",
    "Buying Pattern",
    "Current FY Sales",
    "Current FY Unique PO Count",
    "Current FY Invoice Count",
    "Current FY Active Months",
    ...data.fy_columns,
    "Total Sales",
    "First Purchase Date",
    "Last Purchase Date",
    "Bought Last FY",
    "Bought Previous 2 FYs",
    "Bought All FYs in Data",
    "Bought All Elapsed Months Current FY",
  ];
  const t = writeTable(sheet, "A3", data.customer_summary, "CustomerClassification", headers);
  setWidths(sheet, [42, 28, 18, 24, 20, 21, 16, 14, 14, 14, 14, 14, 14, 14, 16, 14, 14, 13, 13, 16, 20]);
  numberFormat(sheet, "G4:N4000", "#,##0");
  numberFormat(sheet, "O4:O4000", "#,##0");
  sheet.freezePanes.freezeRows(3);
  sheet.freezePanes.freezeColumns(1);
  const statusCol = headers.indexOf("Purchase Status") + 1;
  const patternCol = headers.indexOf("Buying Pattern") + 1;
  sheet.getRange(`${colName(statusCol)}4:${colName(statusCol)}${t.endRow}`).conditionalFormats.add("containsText", { text: "Lost", format: { fill: "#FDE2E2", font: { color: "#991B1B" } } });
  sheet.getRange(`${colName(statusCol)}4:${colName(statusCol)}${t.endRow}`).conditionalFormats.add("containsText", { text: "New", format: { fill: "#E0F2FE", font: { color: "#075985" } } });
  sheet.getRange(`${colName(patternCol)}4:${colName(patternCol)}${t.endRow}`).conditionalFormats.add("containsText", { text: "Regular", format: { fill: "#DCFCE7", font: { color: "#166534" } } });
  sheet.getRange(`${colName(patternCol)}4:${colName(patternCol)}${t.endRow}`).conditionalFormats.add("containsText", { text: "Project", format: { fill: "#FEF3C7", font: { color: "#92400E" } } });
}

function addRepSheet() {
  const sheet = workbook.worksheets.add("Sales Rep Summary");
  sheet.showGridLines = false;
  title(sheet, "Sales Rep Summary", 5);
  writeTable(sheet, "A3", data.rep_summary, "SalesRepSummary");
  setWidths(sheet, [24, 22, 14, 18, 14]);
  numberFormat(sheet, "D4:D500", "#,##0");
  sheet.freezePanes.freezeRows(3);
}

function addMonthSheet() {
  const sheet = workbook.worksheets.add("Current FY Monthly Sales");
  sheet.showGridLines = false;
  const cols = Math.max(2, Object.keys(data.month_pivot[0] ?? {}).length);
  title(sheet, "Current FY Monthly Sales by Customer", cols);
  writeTable(sheet, "A3", data.month_pivot, "CurrentFYMonthlySales");
  setWidths(sheet, [42, 14, 14, 14, 14, 14, 14, 14]);
  numberFormat(sheet, "B4:H1000", "#,##0");
  sheet.freezePanes.freezeRows(3);
  sheet.freezePanes.freezeColumns(1);
}

function addInventorySheet() {
  const sheet = workbook.worksheets.add("Open Order Stock View");
  sheet.showGridLines = false;
  const headers = [
    "Description",
    "Closing_Stock_Qty",
    "Pending_SO_Qty",
    "Pending_PO_Qty",
    "Net After SO",
    "Projected After PO",
    "Inventory Status",
    "Pending_SO_Value",
    "Pending_PO_Value",
    "Closing_Stock_Value",
  ];
  title(sheet, "Open Order Stock View - Top 1000 Items", headers.length);
  const t = writeTable(sheet, "A3", data.item_position, "OpenOrderStockView", headers);
  setWidths(sheet, [58, 14, 14, 14, 14, 16, 20, 16, 16, 16]);
  numberFormat(sheet, "B4:F1100", "#,##0");
  numberFormat(sheet, "H4:J1100", "#,##0");
  const statusCol = headers.indexOf("Inventory Status") + 1;
  sheet.getRange(`${colName(statusCol)}4:${colName(statusCol)}${t.endRow}`).conditionalFormats.add("containsText", { text: "Shortage", format: { fill: "#FDE2E2", font: { color: "#991B1B" } } });
  sheet.getRange(`${colName(statusCol)}4:${colName(statusCol)}${t.endRow}`).conditionalFormats.add("containsText", { text: "Covered", format: { fill: "#FEF3C7", font: { color: "#92400E" } } });
  sheet.freezePanes.freezeRows(3);
  sheet.freezePanes.freezeColumns(1);
}

function addDefinitionsSheet() {
  const sheet = workbook.worksheets.add("Definitions");
  sheet.showGridLines = false;
  title(sheet, "Classification Definitions", 4);
  const rows = [
    ["Rule Area", "Output", "Definition Used", "Notes"],
    ["Financial Year", data.metadata.current_fy, "April to March", "Current FY is derived from the latest sales date in Sales Report."],
    ["Purchase Status", "Repeated Customer", "Customer purchased in current FY and also in last FY.", "Flags also show whether the customer bought in all FYs and previous 2 FYs."],
    ["Purchase Status", "New Customer", "Customer purchased in current FY and had no sales before current FY.", ""],
    ["Purchase Status", "Rebuild Customer", "Customer purchased in current FY, did not purchase in last FY, and purchased earlier than last FY.", ""],
    ["Purchase Status", "Lost Customer", "Customer has no current FY sales value.", "Zero-value current FY transactions do not make a customer active."],
    ["Buying Pattern", "Regular Customer", "Purchased in every FY in the Sales Report and in every elapsed month of current FY.", ""],
    ["Buying Pattern", "Project Customer", "Current FY unique PO count is 5 to 10 and current FY sales value is more than 5 lakhs.", ""],
    ["Buying Pattern", "One Time Customer", "Current FY unique PO count is less than 5 and customer did not purchase in every elapsed current FY month.", ""],
    ["Buying Pattern", "Developing Customer", "Active current FY customer not matching Regular, Project, or One Time rules.", ""],
    ["Inventory Status", "Shortage", "Closing stock quantity minus pending SO balance is below zero.", "Quantity units are kept as workbook numbers; source unit suffixes in the user's description were treated as context."],
    ["Inventory Status", "Covered by Pending PO", "Current stock cannot cover pending SO, but stock plus pending PO can cover it.", ""],
  ];
  sheet.getRange(`A3:D${rows.length + 2}`).values = rows;
  sheet.getRange("A3:D3").format = { fill: "#2F6B5F", font: { bold: true, color: "#FFFFFF" } };
  sheet.getRange(`A3:D${rows.length + 2}`).format.borders = { preset: "all", style: "thin", color: "#E5E7EB" };
  setWidths(sheet, [22, 24, 74, 54]);
  sheet.getRange(`C4:D${rows.length + 2}`).format.wrapText = true;
  sheet.freezePanes.freezeRows(3);
}

addSummarySheet();
addCustomerSheet();
addRepSheet();
addMonthSheet();
addInventorySheet();
addDefinitionsSheet();

const errorScan = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log(errorScan.ndjson);

const previewRanges = {
  "Executive Summary": "A1:E25",
  "Customer Classification": "A1:K35",
  "Sales Rep Summary": "A1:D35",
  "Current FY Monthly Sales": "A1:G35",
  "Open Order Stock View": "A1:J35",
  "Definitions": "A1:D16",
};

for (const [sheetName, range] of Object.entries(previewRanges)) {
  await fs.mkdir(previewDir, { recursive: true });
  const preview = await workbook.render({ sheetName, range, scale: 1, format: "png" });
  await fs.writeFile(path.join(previewDir, `${sheetName.replaceAll(" ", "_")}.png`), new Uint8Array(await preview.arrayBuffer()));
}

await fs.mkdir(rootDir, { recursive: true });
const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);
console.log(`Saved ${outputPath}`);
