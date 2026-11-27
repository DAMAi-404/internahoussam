// End-to-end: shop → owner → labo → shop on the demo backend, three tabs = three devices.
// Run with the dev server up: pnpm dev, then pnpm e2e (BASE_URL / SHOTS_DIR optional).
// Full chain across three "devices" (tabs of one browser = shared demo store, separate sessions).
const { chromium, devices } = require('playwright')
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173'
const SHOTS = process.env.SHOTS_DIR
;(async () => {
  const b = await chromium.launch()
  const c = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 })
  const errs = []
  const shot = (p, n) => (SHOTS ? p.screenshot({ path: `${SHOTS}/e2e-${n}.png` }) : Promise.resolve())
  const W = (ms) => new Promise((r) => setTimeout(r, ms))
  const page = async (role) => {
    const p = await c.newPage()
    p.setDefaultTimeout(6000)
    p.on('pageerror', (e) => errs.push(role + ': ' + e.message))
    p.on('console', (m) => { if (m.type() === 'error') errs.push(role + ' console: ' + m.text()) })
    return p
  }
  const step = async (name, fn) => { try { await fn() } catch (e) { errs.push(name + ': ' + e.message.split('\n')[0]) } }

  const shop = await page('shop')
  await shop.goto(BASE + '/login')
  await shop.evaluate(() => {
    localStorage.clear(); sessionStorage.clear()
    localStorage.setItem('mahroussa-lang', 'fr'); localStorage.setItem('mahroussa-install-dismissed', '1')
  })
  await shop.reload(); await W(1000)
  await shop.click('button:has-text("El Madania") >> nth=0'); await W(1000)
  const owner = await page('owner'); await owner.goto(BASE + '/login'); await W(900)
  await owner.click('button:has-text("Patron") >> nth=0'); await W(1000)
  const labo = await page('labo'); await labo.goto(BASE + '/login'); await W(900)
  await labo.click('button:has-text("Labo") >> nth=0'); await W(1200)
  if (await labo.$('[role=dialog][aria-label="Passation"]')) {
    const pin = await labo.evaluate(() => { const h = (new Date().getUTCHours() + 1) % 24; return h >= 4 && h < 16 ? '1111' : '2222' })
    for (const d of pin) await labo.click(`[role=dialog] button.num:text-is("${d}")`)
    await W(800)
  }
  await shot(labo, '0labo_start')

  let code = ''
  await step('shop order', async () => {
    await shop.bringToFront()
    await shop.click('button[aria-label="Ajouter Pistache"]'); await W(500)
    await shop.click('[role=dialog] button[aria-label="Plus"]'); await shop.click('[role=dialog] button:has-text("Ajouter ·")'); await W(500)
    await shop.click('button[aria-label="Ajouter Cornet"]'); await W(500)
    await shop.click('[role=dialog] button:has-text("Ajouter ·")'); await W(500)
    await shop.click('button:has-text("Panier")'); await W(500)
    await shop.click('button:has-text("Envoyer")'); await W(1500)
    code = (await shop.locator('text=/EMD-\\d{4}-0[3-9]/').first().textContent()).trim()
    await shot(shop, '1shop_sent')
  })
  await step('owner review', async () => {
    await owner.bringToFront(); await W(1500); await shot(owner, '2owner_banner')
    await owner.click(`text=${code}`); await W(1200)
    await owner.click('button:has-text("Envoyer au labo")'); await W(1500)
  })
  await step('labo prepare', async () => {
    await labo.bringToFront(); await W(1500); await shot(labo, '3labo_alarm')
    await labo.click('[role=button]:has-text("El Madania")'); await W(1200); await shot(labo, '4labo_order')
    const rows = await labo.$$('button[aria-pressed]')
    await rows[1].click(); await W(500)
    await labo.click('button[aria-label="Problème"] >> nth=0'); await W(600)
    await labo.click('[role=dialog] [role=radio]:has-text("Rupture")'); await W(200)
    await shot(labo, '5labo_problem')
    await labo.click('[role=dialog] button:has-text("Enregistrer")'); await W(900)
    await shot(labo, '6labo_ready_to_close')
    await labo.click('button:has-text("Clôturer")'); await W(1300)
  })
  await step('shop received', async () => {
    await shop.bringToFront(); await W(1500); await shot(shop, '7shop_ready')
    await shop.click('button:has-text("Reçu") >> nth=0'); await W(1200)
  })
  await step('owner delivered', async () => {
    await owner.bringToFront(); await owner.goto(BASE + '/owner/suivi'); await W(1200)
    await owner.click('button[role=tab]:has-text("Livrées")'); await W(500); await shot(owner, '8owner_delivered')
  })
  console.log(errs.length ? errs.join("\n") : `OK ${code}`)
  process.exitCode = errs.length ? 1 : 0
  await b.close()
})()
