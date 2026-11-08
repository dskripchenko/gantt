// Drives the playground in Chromium: renders the plan in both themes, on a
// desktop and a phone, checks the geometry (bars on their days, the today
// line, milestones), then drags a bar, an edge and a milestone, draws a link,
// moves a bar with the keyboard, watches a refused change roll back and
// undoes. Screenshots go to tests/browser/output (and to GANTT_SHOTS_DIR when
// set). CHROME_PATH runs an installed Chrome instead of Playwright's.
//   node scripts/browser-check.mjs [url]     (starts the playground itself without a url)
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

let server = null
let base = process.argv[2]
if (!base) {
  const { createServer } = await import('vite')
  const root = join(import.meta.dirname, '..')
  const port = Number(process.env.GANTT_CHECK_PORT ?? 5341)
  server = await createServer({ configFile: join(root, 'playground/vite.config.ts'), server: { host: '127.0.0.1', port, strictPort: true }, logLevel: 'warn' })
  await server.listen()
  base = `http://127.0.0.1:${port}/`
}
const out = join(import.meta.dirname, '..', 'tests', 'browser', 'output')
mkdirSync(out, { recursive: true })

const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }

async function open(query, viewport = DESKTOP) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))
  await page.goto(base + query)
  await page.waitForSelector('.gt-row')
  await page.waitForTimeout(300)
  return { page, errors, close: () => context.close() }
}

const rect = (page, selector) => page.locator(selector).first().boundingBox()
const log = (page) => page.locator('[data-test="log"]').innerText()

// Rendering in both themes and sizes.
for (const theme of ['light', 'dark']) {
  for (const [size, viewport] of [['desktop', DESKTOP], ['phone', PHONE]]) {
    const { page, errors, close } = await open(`?theme=${theme}&locale=${theme === 'dark' ? 'ru' : 'en'}`, viewport)
    await page.screenshot({ path: join(out, `plan-${theme}-${size}.png`) })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    check(`${theme} ${size}: no page overflow`, overflow <= 0, String(overflow))
    check(`${theme} ${size}: no errors`, errors.length === 0, errors.join('; '))
    await close()
  }
}

{
  const { page, close } = await open('?zoom=week')
  await page.screenshot({ path: join(out, 'plan-weeks.png') })
  check('week zoom: weekly columns', (await page.locator('.gt-colhead').count()) > 10)
  await close()
}

{
  const { page, errors, close } = await open('')
  const today = await rect(page, '.gt-today')
  const a = await rect(page, '[data-bar-id="A"]')
  const m1 = await rect(page, '[data-milestone-id="m1"] .gt-ms__diamond')
  check('the today line is drawn', today !== null && today.height > 300)
  // A ends on the day of m1: its right edge meets the middle of the diamond's day.
  check('bar A ends where release 1.4 is', Math.abs(a.x + a.width - (m1.x + m1.width / 2)) < 4, `${a.x + a.width} vs ${m1.x + m1.width / 2}`)
  check('links are drawn', (await page.locator('.gt-link').count()) === 2)

  // Drag bar C right by about two weeks.
  const c = await rect(page, '[data-bar-id="C"]')
  const dayWidth = await page.evaluate(() => {
    const cols = [...document.querySelectorAll('.gt-colhead')]
    return cols[1].getBoundingClientRect().width / 31
  })
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2)
  await page.mouse.down()
  await page.mouse.move(c.x + c.width / 2 + dayWidth * 7, c.y + c.height / 2, { steps: 5 })
  check('a tooltip shows the dates while dragging', await page.locator('.gt-tip').isVisible())
  await page.mouse.move(c.x + c.width / 2 + dayWidth * 14, c.y + c.height / 2, { steps: 5 })
  await page.mouse.up()
  await page.waitForTimeout(450)
  const c2 = await rect(page, '[data-bar-id="C"]')
  check('dragging moves the bar by whole days', Math.abs(c2.x - c.x - dayWidth * 14) < 2, `${c2.x - c.x}`)
  check('the change is reported', (await log(page)).includes('change bar'))

  // Resize D's end to the left.
  const d = await rect(page, '[data-bar-id="D"]')
  await page.mouse.move(d.x + d.width - 1, d.y + d.height / 2)
  await page.mouse.down()
  await page.mouse.move(d.x + d.width - 1 - dayWidth * 10, d.y + d.height / 2, { steps: 5 })
  await page.mouse.up()
  await page.waitForTimeout(450)
  const d2 = await rect(page, '[data-bar-id="D"]')
  check('dragging the end edge resizes', Math.abs(d2.x - d.x) < 1 && Math.abs(d.width - d2.width - dayWidth * 10) < 2, `${d.width - d2.width}`)

  // A refused change rolls back.
  const b = await rect(page, '[data-bar-id="B"]')
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2 + dayWidth * 5, b.y + b.height / 2, { steps: 4 })
  await page.mouse.up()
  await page.waitForTimeout(100)
  const bPending = await rect(page, '[data-bar-id="B"]')
  await page.waitForTimeout(500)
  const bAfter = await rect(page, '[data-bar-id="B"]')
  check('a change shows at once, before it is saved', bPending.x > b.x + dayWidth * 4)
  check('a refused change rolls back', Math.abs(bAfter.x - b.x) < 1)
  check('the refusal is reported', (await log(page)).includes('refused'))

  // Draw a link from B to G.
  await page.hover('[data-bar-id="B"]')
  const handle = await rect(page, '[data-bar-id="B"] .gt-bar__handle')
  const g = await rect(page, '[data-bar-id="G"]')
  await page.mouse.move(handle.x + 5, handle.y + 5)
  await page.mouse.down()
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(450)
  check('a link is drawn from the handle', (await page.locator('.gt-link').count()) === 3)

  // Keyboard: move E a day right, then undo.
  const e = await rect(page, '[data-bar-id="E"]')
  await page.focus('[data-bar-id="E"]')
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(450)
  const e2 = await rect(page, '[data-bar-id="E"]')
  check('an arrow key moves a bar by a day', Math.abs(e2.x - e.x - dayWidth) < 1.5, `${e2.x - e.x}`)
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(450)
  const e3 = await rect(page, '[data-bar-id="E"]')
  check('undo brings it back', Math.abs(e3.x - e.x) < 1)

  // A milestone moves with the mouse.
  const m2 = await rect(page, '[data-milestone-id="m2"]')
  await page.mouse.move(m2.x + 9, m2.y + 9)
  await page.mouse.down()
  await page.mouse.move(m2.x + 9 + dayWidth * 3, m2.y + 9, { steps: 4 })
  await page.mouse.up()
  await page.waitForTimeout(450)
  const m2b = await rect(page, '[data-milestone-id="m2"]')
  check('a milestone moves by days', Math.abs(m2b.x - m2.x - dayWidth * 3) < 1.5, `${m2b.x - m2.x}`)

  await page.screenshot({ path: join(out, 'plan-edited.png') })
  check('no errors while editing', errors.length === 0, errors.join('; '))
  await close()
}

{
  const { page, close } = await open('?view=empty&theme=dark')
  check('an empty chart says so', (await page.locator('.gt-empty').innerText()).length > 0)
  await page.screenshot({ path: join(out, 'empty-dark.png') })
  await close()
}

await browser.close()
await server?.close()

if (process.env.GANTT_SHOTS_DIR) {
  mkdirSync(process.env.GANTT_SHOTS_DIR, { recursive: true })
  for (const f of readdirSync(out)) copyFileSync(join(out, f), join(process.env.GANTT_SHOTS_DIR, f))
}
console.log(failures.length ? `\n${failures.length} failed` : '\nall passed')
process.exit(failures.length ? 1 : 0)
