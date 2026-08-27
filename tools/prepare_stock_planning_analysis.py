from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd


SOURCE = Path(r"C:\Users\DELL\Desktop\Stock Planning\Data.xlsx")
OUTPUT_JSON = Path(r"C:\offer Management\outputs\stock_planning_customer_groups\analysis_data.json")


def norm_text(value) -> str:
    if pd.isna(value):
        return ""
    text = str(value).replace("_x000D_", " ")
    text = re.sub(r"\s+", " ", text).strip().upper()
    return text


def fy_start(date: pd.Timestamp) -> int:
    return int(date.year if date.month >= 4 else date.year - 1)


def fy_label(start_year: int) -> str:
    return f"FY {start_year}-{str(start_year + 1)[-2:]}"


def clean_number(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").fillna(0)


def month_label(date: pd.Timestamp) -> str:
    return date.strftime("%b-%Y")


def records_from_df(df: pd.DataFrame) -> list[dict]:
    return json.loads(df.where(pd.notna(df), None).to_json(orient="records", date_format="iso"))


def main():
    xl = pd.ExcelFile(SOURCE)
    customer_master = xl.parse("Customer Master")
    sales = xl.parse("Sales Report")
    stock = xl.parse("Closing Stock")
    pending_po = xl.parse("Pending PO")
    pending_so = xl.parse("Pending SO")

    sales["Date"] = pd.to_datetime(sales["Date"], errors="coerce")
    sales = sales[sales["Date"].notna()].copy()
    sales["Value"] = clean_number(sales["Value"])
    sales["Quantity"] = clean_number(sales["Quantity"])
    sales["Customer Key"] = sales["Customer Name"].map(norm_text)
    sales["PO Key"] = sales["Voucher Ref. No."].map(norm_text)
    missing_po = sales["PO Key"].eq("")
    sales.loc[missing_po, "PO Key"] = sales.loc[missing_po, "Voucher No."].map(norm_text)
    sales["FY Start"] = sales["Date"].map(fy_start)
    sales["FY"] = sales["FY Start"].map(fy_label)
    sales["Month"] = sales["Date"].dt.to_period("M").astype(str)
    sales["Month Label"] = sales["Date"].map(month_label)

    current_fy_start = int(sales["FY Start"].max())
    previous_fy_start = current_fy_start - 1
    previous_2_fy_start = current_fy_start - 2
    current_fy_label = fy_label(current_fy_start)
    current_fy_sales = sales[sales["FY Start"].eq(current_fy_start)].copy()
    elapsed_months = pd.period_range(
        f"{current_fy_start}-04",
        sales["Date"].max().to_period("M"),
        freq="M",
    ).astype(str).tolist()

    master = customer_master.copy()
    master["Customer Key"] = master["Customer Name"].map(norm_text)
    master = master.drop_duplicates("Customer Key")
    master_lookup = master.set_index("Customer Key")[
        ["Customer Name", "Group", "Sales Rep", "Customer Group"]
    ]

    customer_keys = sorted(set(sales["Customer Key"]) | set(master["Customer Key"]))
    rows = []
    fy_starts = list(range(int(sales["FY Start"].min()), current_fy_start + 1))
    for key in customer_keys:
        cust_sales = sales[sales["Customer Key"].eq(key)]
        purchase_sales = cust_sales[cust_sales["Value"].gt(0)]
        current = purchase_sales[purchase_sales["FY Start"].eq(current_fy_start)]
        previous = purchase_sales[purchase_sales["FY Start"].eq(previous_fy_start)]
        prev2 = purchase_sales[purchase_sales["FY Start"].eq(previous_2_fy_start)]
        before_current = purchase_sales[purchase_sales["FY Start"].lt(current_fy_start)]
        before_previous = purchase_sales[purchase_sales["FY Start"].lt(previous_fy_start)]
        current_value = float(current["Value"].sum())
        current_po_count = int(current["PO Key"].replace("", pd.NA).dropna().nunique())
        current_active_months = int(current["Month"].nunique())
        active_fys = set(purchase_sales["FY Start"].unique())
        master_row = master_lookup.loc[key] if key in master_lookup.index else None

        if current_value <= 0:
            purchase_status = "Lost Customer"
        elif float(before_current["Value"].sum()) <= 0:
            purchase_status = "New Customer"
        elif float(previous["Value"].sum()) <= 0 and float(before_previous["Value"].sum()) > 0:
            purchase_status = "Rebuild Customer"
        else:
            purchase_status = "Repeated Customer"

        bought_all_fys = all(fy in active_fys for fy in fy_starts)
        bought_prev_2_years = previous_fy_start in active_fys and previous_2_fy_start in active_fys
        bought_last_year = previous_fy_start in active_fys
        bought_all_elapsed_months = current_active_months == len(elapsed_months) and len(elapsed_months) > 0

        if current_value <= 0:
            buying_pattern = "Inactive in Current FY"
        elif bought_all_fys and bought_all_elapsed_months:
            buying_pattern = "Regular Customer"
        elif 5 <= current_po_count <= 10 and current_value > 500000:
            buying_pattern = "Project Customer"
        elif current_po_count < 5 and not bought_all_elapsed_months:
            buying_pattern = "One Time Customer"
        else:
            buying_pattern = "Developing Customer"

        display_name = str(master_row["Customer Name"]) if master_row is not None else (cust_sales["Customer Name"].iloc[0] if not cust_sales.empty else key)
        if not str(display_name).strip() or str(display_name).strip().lower() == "nan":
            display_name = "(blank customer name)"
        row = {
            "Customer Name": display_name,
            "Tally Group": None if master_row is None or pd.isna(master_row["Group"]) else str(master_row["Group"]),
            "Sales Rep": None if master_row is None or pd.isna(master_row["Sales Rep"]) else str(master_row["Sales Rep"]),
            "Existing Customer Group": None if master_row is None or pd.isna(master_row["Customer Group"]) else str(master_row["Customer Group"]),
            "Purchase Status": purchase_status,
            "Buying Pattern": buying_pattern,
            "Current FY Sales": round(current_value, 2),
            "Current FY Unique PO Count": current_po_count,
            "Current FY Invoice Count": int(current["Voucher No."].nunique()),
            "Current FY Active Months": current_active_months,
            "Total Sales": round(float(cust_sales["Value"].sum()), 2),
            "First Purchase Date": purchase_sales["Date"].min().date().isoformat() if not purchase_sales.empty else None,
            "Last Purchase Date": purchase_sales["Date"].max().date().isoformat() if not purchase_sales.empty else None,
            "Bought Last FY": "Yes" if bought_last_year else "No",
            "Bought Previous 2 FYs": "Yes" if bought_prev_2_years else "No",
            "Bought All FYs in Data": "Yes" if bought_all_fys else "No",
            "Bought All Elapsed Months Current FY": "Yes" if bought_all_elapsed_months else "No",
        }
        for fy in fy_starts:
            row[fy_label(fy) + " Sales"] = round(float(purchase_sales.loc[purchase_sales["FY Start"].eq(fy), "Value"].sum()), 2)
        rows.append(row)

    customer_summary = pd.DataFrame(rows)
    status_order = {
        "Repeated Customer": 1,
        "New Customer": 2,
        "Rebuild Customer": 3,
        "Lost Customer": 4,
    }
    pattern_order = {
        "Regular Customer": 1,
        "Project Customer": 2,
        "Developing Customer": 3,
        "One Time Customer": 4,
        "Inactive in Current FY": 5,
    }
    customer_summary["_Status Sort"] = customer_summary["Purchase Status"].map(status_order).fillna(99)
    customer_summary["_Pattern Sort"] = customer_summary["Buying Pattern"].map(pattern_order).fillna(99)
    customer_summary = customer_summary.sort_values(
        ["_Status Sort", "_Pattern Sort", "Current FY Sales"],
        ascending=[True, True, False],
    ).drop(columns=["_Status Sort", "_Pattern Sort"])

    status_summary = (
        customer_summary.groupby(["Purchase Status", "Buying Pattern"], dropna=False)
        .agg(
            Customers=("Customer Name", "count"),
            Current_FY_Sales=("Current FY Sales", "sum"),
            Current_FY_PO_Count=("Current FY Unique PO Count", "sum"),
        )
        .reset_index()
        .sort_values(["Purchase Status", "Buying Pattern"])
    )
    status_summary["Current_FY_Sales"] = status_summary["Current_FY_Sales"].round(2)

    rep_summary = (
        customer_summary.groupby(["Sales Rep", "Purchase Status"], dropna=False)
        .agg(Customers=("Customer Name", "count"), Current_FY_Sales=("Current FY Sales", "sum"))
        .reset_index()
        .sort_values(["Sales Rep", "Purchase Status"])
    )
    rep_summary["Current_FY_Sales"] = rep_summary["Current_FY_Sales"].round(2)

    month_pivot = (
        current_fy_sales.pivot_table(
            index="Customer Name",
            columns="Month Label",
            values="Value",
            aggfunc="sum",
            fill_value=0,
        )
        .reset_index()
    )
    month_order = [pd.Period(m).to_timestamp().strftime("%b-%Y") for m in elapsed_months]
    month_pivot = month_pivot[["Customer Name"] + [m for m in month_order if m in month_pivot.columns]]

    stock["Item Key"] = stock["Description"].map(norm_text)
    pending_so["Item Key"] = pending_so["Name of Item"].map(norm_text)
    pending_po["Item Key"] = pending_po["Name of Item"].map(norm_text)
    stock_item = stock.groupby("Item Key", as_index=False).agg(
        Description=("Description", "first"),
        Closing_Stock_Qty=("Quantity", "sum"),
        Closing_Stock_Value=("Value", "sum"),
    )
    so_item = pending_so.groupby("Item Key", as_index=False).agg(
        Pending_SO_Qty=("Balance", "sum"),
        Pending_SO_Value=("Value", "sum"),
    )
    po_item = pending_po.groupby("Item Key", as_index=False).agg(
        Pending_PO_Qty=("Balance", "sum"),
        Pending_PO_Value=("Value", "sum"),
    )
    item_keys = pd.DataFrame({"Item Key": sorted(set(stock_item["Item Key"]) | set(so_item["Item Key"]) | set(po_item["Item Key"]))})
    item_position = item_keys.merge(stock_item, how="left", on="Item Key").merge(so_item, how="left", on="Item Key").merge(po_item, how="left", on="Item Key")
    for col in ["Closing_Stock_Qty", "Closing_Stock_Value", "Pending_SO_Qty", "Pending_SO_Value", "Pending_PO_Qty", "Pending_PO_Value"]:
        item_position[col] = clean_number(item_position[col])
    item_position["Description"] = item_position["Description"].fillna(item_position["Item Key"])
    item_position["Net After SO"] = item_position["Closing_Stock_Qty"] - item_position["Pending_SO_Qty"]
    item_position["Projected After PO"] = item_position["Net After SO"] + item_position["Pending_PO_Qty"]
    item_position["Inventory Status"] = item_position.apply(
        lambda r: "Shortage" if r["Net After SO"] < 0 else ("Covered by Pending PO" if r["Projected After PO"] >= 0 and r["Pending_SO_Qty"] > r["Closing_Stock_Qty"] else "Available"),
        axis=1,
    )
    item_position = item_position.sort_values(["Inventory Status", "Pending_SO_Value"], ascending=[True, False])

    payload = {
        "metadata": {
            "source_file": str(SOURCE),
            "source_last_modified": SOURCE.stat().st_mtime,
            "sales_min_date": sales["Date"].min().date().isoformat(),
            "sales_max_date": sales["Date"].max().date().isoformat(),
            "current_fy": current_fy_label,
            "current_fy_start": f"{current_fy_start}-04-01",
            "current_fy_end": f"{current_fy_start + 1}-03-31",
            "elapsed_months": elapsed_months,
            "po_fallback_note": "Blank Voucher Ref. No. values were counted using Voucher No. for unique PO count.",
        },
        "fy_columns": [fy_label(fy) + " Sales" for fy in fy_starts],
        "customer_summary": records_from_df(customer_summary),
        "status_summary": records_from_df(status_summary),
        "rep_summary": records_from_df(rep_summary),
        "month_pivot": records_from_df(month_pivot),
        "item_position": records_from_df(item_position.head(1000)),
    }
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT_JSON}")
    print(f"Customers classified: {len(customer_summary)}")
    print(status_summary.to_string(index=False))


if __name__ == "__main__":
    main()
