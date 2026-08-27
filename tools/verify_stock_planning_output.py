from pathlib import Path

import pandas as pd


OUTPUT = Path(r"C:\offer Management\outputs\stock_planning_customer_groups\Siddhi_Kabel_Stock_Planning_Customer_Groups.xlsx")


def main():
    xl = pd.ExcelFile(OUTPUT)
    print("sheets:", xl.sheet_names)
    for sheet in xl.sheet_names:
        df = xl.parse(sheet)
        print(f"{sheet}: rows={len(df)}, cols={len(df.columns)}")
    detail = xl.parse("Customer Classification", header=2)
    detail = detail[detail["Customer Name"].notna()]
    print("customer rows:", len(detail))
    print(detail[["Purchase Status", "Buying Pattern"]].value_counts().sort_index().to_string())


if __name__ == "__main__":
    main()
