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
