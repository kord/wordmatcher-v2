/**
 * Minimal RFC4180-ish CSV reader.
 *
 * The ChhoeTaigi exports quote every field and some fields contain commas, quotes and
 * newlines (example sentences), so splitting on commas corrupts the row shape. This is
 * deliberately small: it only has to survive that one shape.
 */
export function parseCsv(text: string): string[][] {
    const rows: string[][] = []
    let row: string[] = []
    let field = ''
    let quoted = false

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i]

        if (quoted) {
            if (char === '"') {
                if (text[i + 1] === '"') {
                    field += '"'
                    i += 1
                } else {
                    quoted = false
                }
            } else {
                field += char
            }
            continue
        }

        if (char === '"') {
            quoted = true
        } else if (char === ',') {
            row.push(field)
            field = ''
        } else if (char === '\n') {
            row.push(field)
            rows.push(row)
            row = []
            field = ''
        } else if (char !== '\r') {
            field += char
        }
    }

    if (field.length > 0 || row.length > 0) {
        row.push(field)
        rows.push(row)
    }

    return rows
}
