from pathlib import Path

import pandas as pd


SOURCE = Path(r"C:\Users\DELL\Desktop\Stock Planning\Data.xlsx")


def main():
    xl = pd.ExcelFile(SOURCE)
    print("sheets:")
    for sheet in xl.sheet_names:
        df = xl.parse(sheet, nrows=5)
        full = xl.parse(sheet, usecols=None)
        print(f"- {sheet}: rows={len(full)}, cols={len(full.columns)}")
        print("  columns:", [str(c) for c in full.columns])
        for col in full.columns:
            if "date" in str(col).lower() or str(col).strip().lower() == "due on":
                dates = pd.to_datetime(full[col], errors="coerce")
                if dates.notna().any():
                    print(
                        f"  {col} date range: "
                        f"{dates.min().date()} to {dates.max().date()}"
                    )
        print(df.to_string(index=False))
        print()


if __name__ == "__main__":
    main()
