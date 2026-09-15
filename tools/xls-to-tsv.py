"""Convert Luo Jia-peng's correspondence workbooks to plain TSV.

The reference is xls, which nothing in this project's toolchain reads. A one-file Python
converter is cheaper than adding a spreadsheet dependency to a web app for a source we do not
vendor, and it only has to run when the download is refreshed.

    python convert.py <directory holding the .xls files>

Writes `hantai-characters.tsv` beside this script (workspace `tmp/`, gitignored).

Two tables come out of it:

`char`  from  k_t_duiing.xls  sheet 國語與台語字音表  (12,966 rows)
        one row per (character, Mandarin reading, Taiwanese reading), with the Taiwanese
        reading flagged 文 (literary) or 俗 (colloquial) where the author distinguishes them.

`wenbai` from  t_wenbai.xls  sheet 台語字音表  (2,740 rows)
        one row per character that has both, with the literary reading and the spoken one
        side by side.

Romanisation is Tai-lo spelled with digit tones (`tsit8`, `tann1`, `ting1`), which is what
`Romanization.numbered` already produces, so the two can be compared syllable for syllable.
"""
import sys
from pathlib import Path

import xlrd

HERE = Path(__file__).resolve().parent
source_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "loh" / "駱嘉鵬老師對應表"

rows = []


def cell(sheet, r, c):
    if c >= sheet.ncols:
        return ""
    return str(sheet.cell_value(r, c)).strip()


# --- character table: Mandarin reading to Taiwanese reading -------------------------------
char_sheet = xlrd.open_workbook(source_dir / "k_t_duiing.xls").sheet_by_index(0)
kept = 0
for r in range(1, char_sheet.nrows):
    character = cell(char_sheet, r, 0)
    mandarin = cell(char_sheet, r, 1)
    register = cell(char_sheet, r, 11)
    tailo = cell(char_sheet, r, 12)
    if not character or not tailo:
        continue
    rows.append(("char", character, mandarin, register, tailo))
    kept += 1

# --- literary/spoken pairs ----------------------------------------------------------------
wenbai_sheet = xlrd.open_workbook(source_dir / "t_wenbai.xls").sheet_by_index(0)
pairs = 0
for r in range(1, wenbai_sheet.nrows):
    character = cell(wenbai_sheet, r, 0)
    literary = cell(wenbai_sheet, r, 1)
    spoken = cell(wenbai_sheet, r, 2)
    if not character or not literary or not spoken:
        continue
    rows.append(("wenbai", character, literary, spoken, ""))
    pairs += 1

out = HERE / "hantai-characters.tsv"
with out.open("w", encoding="utf-8", newline="\n") as handle:
    handle.write("kind\tcharacter\tone\ttwo\tthree\n")
    for row in rows:
        handle.write("\t".join(row) + "\n")

print(f"{out}")
print(f"char rows: {kept}, wenbai rows: {pairs}, total: {len(rows)}")
