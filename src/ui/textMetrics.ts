/**
 * Text measurement for layout decisions.
 *
 * Widths are linear in font size, so one measurement at a reference size answers
 * every size. Results are cached per string: the original app re-measured every
 * option with a fresh canvas on every render, which was the real problem here,
 * not using a canvas as such.
 */
export const REFERENCE_FONT_SIZE = 100

const widthCache = new Map<string, number>()
const CACHE_LIMIT = 500

let context: CanvasRenderingContext2D | null | undefined

function measureContext(): CanvasRenderingContext2D | null {
  if (context !== undefined) return context

  context =
    typeof document === 'undefined'
      ? null
      : document.createElement('canvas').getContext('2d')

  return context
}

/** Width of `text` in px when drawn at `font` set to REFERENCE_FONT_SIZE. */
export function textWidthAtReference(text: string, font: string): number {
  const key = `${font}\u0000${text}`
  const cached = widthCache.get(key)
  if (cached !== undefined) return cached

  const ctx = measureContext()
  if (!ctx) return 0

  ctx.font = font
  const width = ctx.measureText(text).width

  if (widthCache.size > CACHE_LIMIT) widthCache.clear()
  widthCache.set(key, width)

  return width
}

export function clearTextMetricsCache(): void {
  widthCache.clear()
}
