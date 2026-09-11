/**
 * Generates the PWA icon set from a single vector definition.
 *
 * The mark is 媲 (pi4, "to match, to rival" - as in 媲美), reversed out of a solid
 * gold diamond on the app's ink background. Everything is drawn as vector and
 * rasterised by Chromium at the exact target size, so every file is crisp and the
 * whole set can be regenerated with `npm run icons` after any tweak.
 *
 * Two variants:
 *
 *   full    gold diamond + 媲 -> every normal size: favicons (16, 32, 48), the
 *                                home screen (192, 512) and iOS (180)
 *   masked  full, scaled 80%  -> Android maskable, so the diamond's points stay
 *                                inside the guaranteed-visible circle
 *
 * The glyph is kept at favicon sizes even though 媲 cannot be read at 16px. A bare
 * gold diamond reads as a different app - the dark core is what makes the small
 * icons recognisable as the same mark. It is sized so it never crowds the diamond's
 * edges, which is the difference between a smudge and a deliberate element.
 *
 * Run: npm run icons
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Keep in step with `INK` in vite.config.ts. */
const INK = '#1a1917'
const GOLD_LIGHT = '#f3d477'
const GOLD_DEEP = '#c4911a'
const GLYPH = '\u5ab2' // 媲
const GLYPH_FONT = "'Microsoft YaHei', 'Noto Sans SC', 'PingFang SC', sans-serif"

/** Diamond vertex distance from centre, on the 512 design grid. */
const DIAMOND_RADIUS = 232
/**
 * Ink height of the glyph as a fraction of the canvas. Sized so the glyph's corners
 * keep clear of the diamond's edges - a diamond is an awkward frame for a square
 * glyph, because its edges crowd the corners. Any larger and the glyph reads as
 * bleeding into the frame rather than sitting inside it, which is what makes the
 * 16px version look like a smudge instead of a deliberate core.
 */
const GLYPH_HEIGHT_RATIO = 0.4
/**
 * Emboldening, in canvas pixels. Enough to look deliberate at 192px, but a heavier
 * stroke closes the counters in the glyph and it turns to mush.
 */
const GLYPH_EMBOLDEN = 3

const CANVAS = 512

function diamondPoints(radius) {
    const c = CANVAS / 2
    return [
        [c, c - radius],
        [c + radius, c],
        [c, c + radius],
        [c - radius, c],
    ]
        .map(([x, y]) => `${x},${y}`)
        .join(' ')
}

/**
 * The design at a given scale. `scale` shrinks the mark inside the full-bleed
 * background so a mask cannot reach it.
 */
function svg({ scale, glyphTransform, glyphScale }) {
    const c = CANVAS / 2
    const transform = `translate(${c} ${c}) scale(${scale}) translate(${-c} ${-c})`

    // The emboldening is quoted in canvas pixels, so divide out the glyph's own
    // scale to keep it constant however large the glyph ends up being drawn.
    const stroke = (GLYPH_EMBOLDEN / glyphScale).toFixed(2)

    const glyph =
        `<text x="0" y="0" transform="${glyphTransform}" font-family="${GLYPH_FONT}" ` +
        `font-weight="700" font-size="100" fill="${INK}" stroke="${INK}" ` +
        `stroke-width="${stroke}" stroke-linejoin="round">${GLYPH}</text>`

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${GOLD_LIGHT}"/>
      <stop offset="1" stop-color="${GOLD_DEEP}"/>
    </linearGradient>
  </defs>
  <rect width="${CANVAS}" height="${CANVAS}" fill="${INK}"/>
  <g transform="${transform}">
    <polygon points="${diamondPoints(DIAMOND_RADIUS)}" fill="url(#gold)"/>
    ${glyph}
  </g>
</svg>`
}

/** Scales the glyph's ink box to `height` px and centres it on the canvas. */
function fitGlyph(ink, height) {
    const glyphScale = height / ink.height
    const cx = ink.x + ink.width / 2
    const cy = ink.y + ink.height / 2
    return {
        // Named with the `glyph` prefix so it cannot collide with the variant's own
        // `scale` when these are spread into `svg`.
        glyphTransform: `translate(${CANVAS / 2} ${CANVAS / 2}) scale(${glyphScale}) translate(${-cx} ${-cy})`,
        glyphScale,
    }
}

async function main() {
    const browser = await chromium.launch()
    const page = await browser.newPage({ deviceScaleFactor: 1 })

    // Measure the glyph's ink box rather than trusting the font's metrics, so the
    // mark is centred on what is actually drawn.
    await page.setContent(
        `<body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}">` +
        `<text id="probe" x="0" y="0" font-family="${GLYPH_FONT}" font-weight="700" font-size="100" ` +
        `stroke-width="${GLYPH_EMBOLDEN}" stroke-linejoin="round">${GLYPH}</text></svg></body>`,
    )
    const ink = await page.evaluate(() => {
        const box = document.getElementById('probe').getBBox()
        return { x: box.x, y: box.y, width: box.width, height: box.height }
    })

    const glyph = fitGlyph(ink, CANVAS * GLYPH_HEIGHT_RATIO)
    const variants = {
        full: svg({ scale: 1, ...glyph }),
        // 0.8 keeps the diamond's vertices inside the maskable safe circle, and the
        // background still bleeds to every edge.
        masked: svg({ scale: 0.8, ...glyph }),
    }

    const directory = join(root, 'public')
    mkdirSync(join(directory, 'icons'), { recursive: true })

    const render = async (variant, size) => {
        await page.setViewportSize({ width: size, height: size })
        await page.setContent(
            `<body style="margin:0">` +
            variants[variant].replace(
                `width="${CANVAS}" height="${CANVAS}"`,
                `width="${size}" height="${size}"`,
            ) +
            `</body>`,
        )
        return page.locator('svg').screenshot()
    }

    const targets = [
        { variant: 'full', size: 512, path: 'icons/icon-512.png' },
        { variant: 'full', size: 192, path: 'icons/icon-192.png' },
        { variant: 'full', size: 180, path: 'apple-touch-icon.png' },
        { variant: 'masked', size: 512, path: 'icons/maskable-512.png' },
        { variant: 'masked', size: 192, path: 'icons/maskable-192.png' },
        { variant: 'full', size: 48, path: 'icons/favicon-48x48.png' },
        { variant: 'full', size: 32, path: 'favicon-32x32.png' },
        { variant: 'full', size: 16, path: 'favicon-16x16.png' },
    ]

    const written = []
    for (const target of targets) {
        const png = await render(target.variant, target.size)
        writeFileSync(join(directory, target.path), png)
        written.push(`${target.path} (${png.length} bytes)`)
    }

    // favicon.ico is a tiny container of PNGs; wrapping them by hand avoids pulling
    // in an image library just for this.
    const icoSizes = [16, 32, 48]
    const images = []
    for (const size of icoSizes) images.push({ size, png: await render('full', size) })
    writeFileSync(join(directory, 'favicon.ico'), buildIco(images))
    written.push(`favicon.ico (${icoSizes.join(', ')})`)

    await browser.close()
    for (const line of written) console.log('  ' + line)
}

/** ICONDIR + ICONDIRENTRY per image, with PNG payloads (Vista and later). */
function buildIco(images) {
    const header = Buffer.alloc(6)
    header.writeUInt16LE(0, 0) // reserved
    header.writeUInt16LE(1, 2) // 1 = icon
    header.writeUInt16LE(images.length, 4)

    const entries = []
    let offset = 6 + images.length * 16

    for (const { size, png } of images) {
        const entry = Buffer.alloc(16)
        entry.writeUInt8(size >= 256 ? 0 : size, 0) // 0 means 256
        entry.writeUInt8(size >= 256 ? 0 : size, 1)
        entry.writeUInt8(0, 2) // palette size
        entry.writeUInt8(0, 3) // reserved
        entry.writeUInt16LE(1, 4) // colour planes
        entry.writeUInt16LE(32, 6) // bits per pixel
        entry.writeUInt32LE(png.length, 8)
        entry.writeUInt32LE(offset, 12)
        entries.push(entry)
        offset += png.length
    }

    return Buffer.concat([header, ...entries, ...images.map((image) => image.png)])
}

await main()
