import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/**
 * Writes a report into the workspace's `tmp/` folder and returns the path.
 *
 * Not the system temp directory: these are files a person reads while working on the data, so
 * they belong in the editor's file tree where they can be opened, and they should survive a
 * reboot. `tmp` is gitignored.
 *
 * The file is written as UTF-8 by Node itself rather than printed, because PowerShell 5.1
 * decodes a native command's stdout with the OEM codepage (CP850) and turns every CJK character
 * into mojibake.
 */
export async function writeReport(name: string, text: string): Promise<string> {
    const path = join(process.cwd(), 'tmp', name)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, text, 'utf8')
    return path
}
