import { expect, test } from '@playwright/test'

/** Fail if anything makes the page scroll sideways. */
async function horizontalOverflow(page: import('@playwright/test').Page): Promise<number> {
    return page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
}

test('home screen renders the selected list and does not overflow', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText('Word Matcher').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start session' })).toBeVisible()
    await expect(page.getByText(/HSK 1/)).toBeVisible()

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
})

test('session, reveal and summary all fit the viewport', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Start session' }).click()

    const options = page.getByTestId('option')
    await expect(options.first()).toBeVisible()
    expect(await options.count()).toBeGreaterThanOrEqual(2)
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)

    // Neither the prompt nor any option may spill out of its box, at any viewport.
    const measureSpillage = () =>
        page.evaluate(() => {
            const px = (value: string) => Number.parseFloat(value) || 0

            const promptBox = document.querySelector('[data-testid="prompt"]')
            const promptText = promptBox ? promptBox.querySelector('div') : null
            let promptSpills = false
            if (promptBox && promptText) {
                const style = getComputedStyle(promptBox)
                const availableWidth =
                    promptBox.clientWidth - px(style.paddingLeft) - px(style.paddingRight)
                const availableHeight =
                    promptBox.clientHeight - px(style.paddingTop) - px(style.paddingBottom)
                promptSpills =
                    promptText.scrollWidth > availableWidth + 1 ||
                    promptText.scrollHeight > availableHeight + 1
            }

            const optionSpills = Array.from(document.querySelectorAll('[data-option-text]')).some(
                (el) => {
                    const button = el.closest('button')
                    if (!button) return false
                    const text = el.getBoundingClientRect()
                    const box = button.getBoundingClientRect()
                    return text.width > box.width + 1 || text.height > box.height + 1
                },
            )

            return { promptSpills, optionSpills }
        })

    expect(await measureSpillage()).toEqual({ promptSpills: false, optionSpills: false })

    // A prompt made of characters must not be split across lines, whatever its
    // length: the text shrinks to fit the width instead.
    const promptLineCount = await page.evaluate(() => {
        const box = document.querySelector('[data-testid="prompt"]')
        const el = box ? box.querySelector('div') : null
        if (!el) return null
        if (!/[\u4e00-\u9fff]/.test(el.textContent ?? '')) return null

        const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || 1
        return Math.round(el.getBoundingClientRect().height / lineHeight)
    })

    if (promptLineCount !== null) expect(promptLineCount).toBe(1)

    await options.first().click()

    await expect(page.getByTestId('reveal')).toBeVisible()
    // The reveal takes height away, so the text must have been re-fitted to it.
    // A trace at 25ms resolution shows the re-fit lands inside the first rendering
    // step after the reveal (the resize observer fires before paint, so the
    // player never sees the stale size), but reading layout in the same task -
    // before that step runs - still sees the old one. Let the step happen first.
    await page.waitForTimeout(100)
    expect(await measureSpillage()).toEqual({ promptSpills: false, optionSpills: false })

    // The vertical budget is the layout's job: nothing may be clipped.
    const clipped = await page.evaluate(() => {
        const el = document.documentElement
        return el.scrollHeight - el.clientHeight
    })
    expect(clipped).toBeLessThanOrEqual(1)

    await page.getByRole('button', { name: 'End session' }).click()
    await expect(page.getByText('Session complete')).toBeVisible()
})

test('a miss can be reviewed and re-practised', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Start session' }).click()

    const options = page.getByTestId('option')
    const reveal = page.getByTestId('reveal')
    await expect(options.first()).toBeVisible()

    // Always tap the first option. With four choices, missing within twelve
    // questions is effectively certain - and a miss is what this test needs.
    let missed = false
    for (let attempt = 0; attempt < 12 && !missed; attempt++) {
        await options.first().click()
        await expect(reveal).toBeVisible()
        missed = (await reveal.locator('[class*="revealMiss"]').count()) > 0
        if (!missed) {
            await page.keyboard.press('Space')
            await page.waitForTimeout(120)
        }
    }
    expect(missed).toBe(true)

    await page.getByRole('button', { name: 'End session' }).click()
    await expect(page.getByText('Session complete')).toBeVisible()

    await page.getByRole('button', { name: /Review mistakes/ }).click()
    await expect(page.getByText('Review mistakes').first()).toBeVisible()

    await page.getByRole('button', { name: 'Practise these again' }).click()
    await expect(page.getByTestId('option').first()).toBeVisible()
})

/**
 * The bug this guards against: `.promptText` clipped to its own box, and that box
 * is only `lines x line-height` tall - shorter than the font's own box (Segoe UI
 * measures ~1.33em against a 1.15em line-height). Every descender was sliced off,
 * so the gloss prompt "job" lost most of its j. Box geometry never caught it
 * because `scrollHeight` ignores ink overflow, so this has to look at glyphs.
 */
test('no glyph is ever clipped, in any face, asking or revealed', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Start session' }).click()
    await expect(page.getByTestId('option').first()).toBeVisible()

    const clippingProblems = () =>
        page.evaluate(() => {
            const problems: string[] = []

            // Where the drawn glyphs sit, versus the box that would clip them.
            const examine = (textEl: Element, clipEl: Element, label: string) => {
                const style = getComputedStyle(textEl)
                const text = (textEl.textContent ?? '').replace(/\s+/g, ' ').trim()
                if (!text) return

                const fontSize = Number.parseFloat(style.fontSize)
                const lineHeight = Number.parseFloat(style.lineHeight)
                if (!Number.isFinite(fontSize) || !Number.isFinite(lineHeight)) return

                const context = document.createElement('canvas').getContext('2d')
                if (!context) return
                context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`

                const metric = context.measureText('H')
                const ascent = metric.fontBoundingBoxAscent
                const descent = metric.fontBoundingBoxDescent
                if (!Number.isFinite(ascent) || !Number.isFinite(descent)) return

                const ink = context.measureText(text)
                const box = textEl.getBoundingClientRect()
                const halfLeading = (lineHeight - (ascent + descent)) / 2

                // The line boxes sit inside the padding, and `useFitText` pads the
                // bottom to hold the ink, so the baselines must be derived from the
                // content box rather than from the border box.
                const contentTop = box.top + Number.parseFloat(style.paddingTop)
                const contentBottom = box.bottom - Number.parseFloat(style.paddingBottom)

                // Conservative ink bounds: the tallest ascent and the deepest descent
                // in the whole string, hung off the first and last baselines. When the
                // text wraps, the deepest descender may not be on the last line, which
                // errs on the safe side.
                const inkTop = contentTop + halfLeading + ascent - ink.actualBoundingBoxAscent
                const inkBottom =
                    contentBottom - halfLeading - descent + ink.actualBoundingBoxDescent

                // Overflow clips to the padding box, i.e. inside the border.
                const clipStyle = getComputedStyle(clipEl)
                const clipBox = clipEl.getBoundingClientRect()
                const clipTop = clipBox.top + Number.parseFloat(clipStyle.borderTopWidth)
                const clipBottom = clipBox.bottom - Number.parseFloat(clipStyle.borderBottomWidth)

                const overhang = Math.max(inkBottom - clipBottom, clipTop - inkTop)
                if (overhang > 0.5) {
                    problems.push(`${label} "${text}" is drawn ${overhang.toFixed(1)}px past the clip line`)
                }
            }

            // The box that actually cuts the ink is the nearest ancestor with
            // non-visible overflow - often the text element itself, which is what
            // clipped the descenders in the first place.
            const clipBoxFor = (element: Element): Element => {
                let node: Element | null = element
                while (node) {
                    const style = getComputedStyle(node)
                    if (style.overflowX !== 'visible' || style.overflowY !== 'visible') return node
                    node = node.parentElement
                }
                return document.documentElement
            }

            const promptBox = document.querySelector('[data-testid="prompt"]')
            const promptText = promptBox ? promptBox.querySelector('div') : null
            if (promptText) examine(promptText, clipBoxFor(promptText), 'prompt')

            document.querySelectorAll('[data-testid="option"]').forEach((button, index) => {
                const textEl = button.querySelector('[data-option-text]')
                if (textEl) examine(textEl, clipBoxFor(textEl), `option ${index}`)
            })

            return problems
        })

    // Sweep questions in both states, so every objective and face gets exercised.
    for (let round = 0; round < 8; round++) {
        expect(await clippingProblems(), 'while asking').toEqual([])

        await page.getByTestId('option').first().click()
        await expect(page.getByTestId('reveal')).toBeVisible()
        // The reveal steals height from the prompt, and the font is re-fitted a
        // frame or so later (measured: settled within 50ms). Assert the settled
        // layout, which is the one the player actually reads.
        await page.waitForTimeout(250)
        expect(await clippingProblems(), 'while revealed').toEqual([])

        await page.keyboard.press('Space')
        await page.waitForTimeout(250)
    }
})
