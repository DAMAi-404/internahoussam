#!/usr/bin/env node
/**
 * One-time go-live setup (docs/GO_LIVE.md). Run AFTER the migrations are applied.
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/setup-supabase.mjs scripts/setup.config.json
 * - creates/updates the owner, deputy and labo accounts, and one account per shop (PIN = password)
 * - sets the two labo team PINs
 * - generates the VAPID key pair for Web Push and wires the `notify` edge function (app_config)
 * Writes scripts/setup.output.json (git-ignored) with the shop PINs and keys: keep it private.
 * Safe to run again: existing accounts are updated, not duplicated.
 */
import { createClient } from '@supabase/supabase-js'
import { createECDH, randomBytes, randomInt } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const configPath = process.argv[2] ?? 'scripts/setup.config.json'
if (!url || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}
const config = JSON.parse(readFileSync(configPath, 'utf8'))
const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const shopEmail = (id) => `shop-${id}@accounts.mahroussa.app` // must match src/backend/supabase.ts
const pin = (n) => Array.from({ length: n }, () => randomInt(10)).join('')
const b64url = (buf) => Buffer.from(buf).toString('base64url')

async function allUsers() {
  const users = []
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    users.push(...data.users)
    if (data.users.length < 200) return users
  }
}

async function upsertUser(existing, email, password, profile) {
  const found = existing.find((u) => u.email === email)
  const { data, error } = found
    ? await sb.auth.admin.updateUserById(found.id, { password, email_confirm: true })
    : await sb.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw new Error(`${email}: ${error.message}`)
  const { error: pErr } = await sb.from('profiles').upsert({ user_id: data.user.id, ...profile })
  if (pErr) throw new Error(`${email} profile: ${pErr.message}`)
  return data.user.id
}

const existing = await allUsers()
const out = { shops: {}, teams: {}, vapid: {} }

await upsertUser(existing, config.owner.email, config.owner.password, { role: 'owner', shop_id: null, display_name: config.owner.name ?? 'Patron', locale: 'fr' })
console.log(`✓ owner  ${config.owner.email}`)
if (config.deputy?.email) {
  await upsertUser(existing, config.deputy.email, config.deputy.password, { role: 'deputy', shop_id: null, display_name: config.deputy.name ?? 'Adjoint', locale: config.deputy.locale ?? 'ar' })
  console.log(`✓ deputy ${config.deputy.email}`)
}
await upsertUser(existing, config.labo.email, config.labo.password, { role: 'labo', shop_id: null, display_name: 'Labo', locale: config.labo.locale ?? 'ar' })
console.log(`✓ labo   ${config.labo.email}`)

const { data: shops, error: shopsErr } = await sb.from('shops').select('id, name_fr').order('sort')
if (shopsErr) throw shopsErr
for (const s of shops) {
  const p = config.shopPins?.[s.id] ?? pin(6)
  await upsertUser(existing, shopEmail(s.id), p, { role: 'shop', shop_id: s.id, display_name: s.name_fr, locale: 'ar' })
  out.shops[s.name_fr] = p
  console.log(`✓ shop   ${s.name_fr.padEnd(18)} PIN ${p}`)
}

for (const team of ['matin', 'nuit']) {
  const p = config.teamPins?.[team] ?? pin(4)
  const { error } = await sb.rpc('set_team_pin', { p_team: team, p_pin: p })
  if (error) throw new Error(`team ${team}: ${error.message}`)
  out.teams[team] = p
  console.log(`✓ team   ${team.padEnd(18)} PIN ${p}`)
}

// Web Push: VAPID key pair (P-256). Public key goes to the app, private key to the edge function secrets.
const ecdh = createECDH('prime256v1')
ecdh.generateKeys()
const priv = ecdh.getPrivateKey()
const priv32 = Buffer.concat([Buffer.alloc(32 - priv.length), priv]) // web-push needs exactly 32 bytes
out.vapid = { publicKey: b64url(ecdh.getPublicKey()), privateKey: b64url(priv32), subject: config.vapidSubject ?? `mailto:${config.owner.email}` }
out.notifySecret = b64url(randomBytes(24))
const { error: cfgErr } = await sb.from('app_config').upsert([
  { key: 'notify_url', value: `${url}/functions/v1/notify` },
  { key: 'notify_secret', value: out.notifySecret },
])
if (cfgErr) throw new Error(`app_config: ${cfgErr.message}`)

writeFileSync('scripts/setup.output.json', JSON.stringify(out, null, 2))
console.log('\nSaved scripts/setup.output.json (private: shop PINs, team PINs, push keys).')
console.log('Next: set the edge function secrets and the app env vars as listed in docs/GO_LIVE.md.')
