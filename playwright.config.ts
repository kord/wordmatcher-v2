import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const baseURL = `http://localhost:${PORT}`

/**
 * The app is phone-only, so the suite runs against a spread of small screens:
 * a short device, a modern tall device, an Android viewport, and a phone in
 * landscape (the layout that used to break).
 */
export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    reporter: [['list']],
    use: {
        baseURL,
        trace: 'on-first-retry',
    },
    projects: [
        // The device descriptors only supply viewport, scale, touch and user agent.
        // Chromium is pinned explicitly so the suite runs on one engine; add a
        // WebKit project if iOS-specific regressions need covering.
        { name: 'iphone-se', use: { ...devices['iPhone SE'], browserName: 'chromium' } },
        { name: 'iphone-12', use: { ...devices['iPhone 12'], browserName: 'chromium' } },
        { name: 'pixel-7', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
        {
            name: 'phone-landscape',
            use: {
                ...devices['iPhone 12'],
                browserName: 'chromium',
                viewport: { width: 750, height: 390 },
            },
        },
    ],
    webServer: {
        command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
})
