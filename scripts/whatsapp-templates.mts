#!/usr/bin/env tsx
/**
 * Creates WhatsApp message templates for the RSVP system.
 *
 * Usage:
 *   npm run whatsapp:templates
 *
 * Required env vars (in .env.local):
 *   WHATSAPP_ACCESS_TOKEN    — permanent token or system user token
 *   WHATSAPP_WABA_ID         — WhatsApp Business Account ID
 *   WHATSAPP_APP_ID          — App ID (for Resumable Upload of sample image)
 *   NEXT_PUBLIC_SITE_URL     — e.g. https://your-app.vercel.app
 *   WHATSAPP_GRAPH_VERSION   — optional, default v25.0
 *
 * The script:
 *   1. Fetches existing templates (to skip creation if already present).
 *   2. Uploads public/template-sample.jpg as the header sample image.
 *   3. Creates any missing templates.
 *   4. Prints the status of every template.
 *
 * Template sample image:
 *   Place a generic 1200×630 JPEG at public/template-sample.jpg.
 *   It must NOT contain real names. Meta uses it only for review, not in sent messages.
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

// ── Config ────────────────────────────────────────────────────────────────────

const ACCESS_TOKEN   = process.env.WHATSAPP_ACCESS_TOKEN
const WABA_ID        = process.env.WHATSAPP_WABA_ID
const APP_ID         = process.env.WHATSAPP_APP_ID
const SITE_URL       = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
const GRAPH_VERSION  = process.env.WHATSAPP_GRAPH_VERSION ?? 'v25.0'

const REQUIRED_VARS = ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_WABA_ID', 'WHATSAPP_APP_ID', 'NEXT_PUBLIC_SITE_URL']
const missing = REQUIRED_VARS.filter((v) => !process.env[v])
if (missing.length > 0) {
  console.error(`✗ Missing env vars: ${missing.join(', ')}`)
  console.error('  Copy .env.example to .env.local and fill in the values.')
  process.exit(1)
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SAMPLE_IMAGE_PATH = path.resolve(__dirname, '../public/template-sample.jpg')

// ── Helpers ───────────────────────────────────────────────────────────────────

async function graphGet<T>(endpoint: string): Promise<T> {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${endpoint}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  })
  const json = await res.json() as T
  if (!res.ok) throw new Error(JSON.stringify(json))
  return json
}

async function graphPost<T>(endpoint: string, body: object): Promise<T> {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${endpoint}`
  const res = await fetch(url, {
    method:  'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  const json = await res.json() as T
  if (!res.ok) throw new Error(JSON.stringify(json))
  return json
}

// ── Resumable Upload API ──────────────────────────────────────────────────────

async function uploadSampleImage(): Promise<string> {
  if (!fs.existsSync(SAMPLE_IMAGE_PATH)) {
    console.error(`✗ Sample image not found at: ${SAMPLE_IMAGE_PATH}`)
    console.error('  Create a generic 1200×630 JPEG (no real names) and save it there.')
    process.exit(1)
  }

  const imageBytes = fs.readFileSync(SAMPLE_IMAGE_PATH)
  const fileLength = imageBytes.length
  console.log(`  Uploading sample image (${fileLength} bytes)…`)

  // Step 1: create upload session
  const sessionUrl =
    `https://graph.facebook.com/${GRAPH_VERSION}/${APP_ID}/uploads` +
    `?file_length=${fileLength}&file_type=image/jpeg&access_token=${ACCESS_TOKEN}`
  const sessionRes = await fetch(sessionUrl, { method: 'POST' })
  const sessionJson = await sessionRes.json() as { id?: string; error?: unknown }
  if (!sessionRes.ok || !sessionJson.id) {
    throw new Error(`Failed to create upload session: ${JSON.stringify(sessionJson)}`)
  }
  const uploadSessionId = sessionJson.id

  // Step 2: upload file bytes
  const uploadUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${uploadSessionId}`
  const uploadRes = await fetch(uploadUrl, {
    method:  'POST',
    headers: {
      Authorization:  `OAuth ${ACCESS_TOKEN}`,
      file_offset:    '0',
      'Content-Type': 'image/jpeg',
    },
    body: imageBytes,
  })
  const uploadJson = await uploadRes.json() as { h?: string; error?: unknown }
  if (!uploadRes.ok || !uploadJson.h) {
    throw new Error(`Failed to upload image: ${JSON.stringify(uploadJson)}`)
  }

  console.log(`  ✓ Uploaded. Handle: ${uploadJson.h}`)
  return uploadJson.h
}

// ── Fetch existing templates ──────────────────────────────────────────────────

interface ExistingTemplate {
  name: string
  status: string
  rejected_reason?: string
}

async function fetchExistingTemplates(): Promise<Map<string, ExistingTemplate>> {
  console.log('Fetching existing templates…')
  const data = await graphGet<{ data: ExistingTemplate[] }>(
    `${WABA_ID}/message_templates?fields=name,status,rejected_reason&limit=100`,
  )
  const map = new Map<string, ExistingTemplate>()
  for (const t of data.data ?? []) map.set(t.name, t)
  return map
}

// ── Template definitions ──────────────────────────────────────────────────────

type Component =
  | { type: 'HEADER'; format: string; example?: { header_handle: string[] } }
  | { type: 'BODY'; text: string; example?: { body_text: string[][] } }
  | { type: 'FOOTER'; text: string }
  | { type: 'BUTTONS'; buttons: { type: string; text: string; url?: string }[] }

interface TemplateDef {
  name:       string
  category:   'MARKETING' | 'UTILITY'
  language:   string
  components: Component[]
}

function buildTemplates(imageHandle: string | null): TemplateDef[] {
  const buttonUrl = `${SITE_URL}/r/{{1}}`

  const invitation: TemplateDef = {
    name:     'rsvp_invitation',
    category: 'MARKETING',
    language: 'he',
    components: [
      ...(imageHandle
        ? [{ type: 'HEADER' as const, format: 'IMAGE', example: { header_handle: [imageHandle] } }]
        : []),
      {
        type: 'BODY',
        text: `שלום {{1}},\nהוזמנתם לחתונה של {{2}}\nבתאריך {{3}} ב{{4}}.\nפרטים נוספים ואישור הגעה בלינק המצורף:\n${SITE_URL}/r/{{5}}\nנשמח לראותכם!`,
        example: {
          body_text: [['דנה', 'נטע פרטוש ורון אוטמזגין', '05.11.26 בשעה 19:30', 'גני דניאל, דימונה', 'a1b2c3d4e5f60718']],
        },
      },
      { type: 'FOOTER', text: 'להסרה מרשימת התפוצה השיבו "הסר"' },
      {
        type: 'BUTTONS',
        buttons: [{ type: 'URL', text: 'לפרטים ואישור הגעה', url: buttonUrl }],
      },
    ],
  }

  const reminder: TemplateDef = {
    name:     'rsvp_reminder',
    category: 'MARKETING',
    language: 'he',
    components: [
      {
        type: 'BODY',
        text: `שלום {{1}},\nרק מזכירים שהחתונה של {{2}} מתקרבת ({{3}}), ועדיין לא קיבלנו ממך אישור הגעה.\nלאישור בלחיצה:\n${SITE_URL}/r/{{4}}\nתודה!`,
        example: {
          body_text: [['דנה', 'נטע פרטוש ורון אוטמזגין', '05.11.26 בשעה 19:30', 'a1b2c3d4e5f60718']],
        },
      },
      { type: 'FOOTER', text: 'להסרה מרשימת התפוצה השיבו "הסר"' },
      {
        type: 'BUTTONS',
        buttons: [{ type: 'URL', text: 'לאישור הגעה', url: buttonUrl }],
      },
    ],
  }

  const event_day: TemplateDef = {
    name:     'rsvp_event_day',
    category: 'UTILITY',
    language: 'he',
    components: [
      {
        type: 'BODY',
        text: `שלום {{1}},\nמחכים לראותך היום בחתונה של {{2}} ב{{3}}.\nניווט, פרטי האירוע ומקום הישיבה בכפתור למטה.`,
        example: {
          body_text: [['דנה', 'נטע פרטוש ורון אוטמזגין', 'גני דניאל, דימונה']],
        },
      },
      {
        type: 'BUTTONS',
        buttons: [{ type: 'URL', text: 'פרטים וניווט', url: buttonUrl }],
      },
    ],
  }

  const thank_you: TemplateDef = {
    name:     'rsvp_thank_you',
    category: 'MARKETING',
    language: 'he',
    components: [
      {
        type: 'BODY',
        text: `שלום {{1}},\nתודה שבאתם לחגוג איתנו! היה מרגש שהייתם חלק מהיום שלנו.\nבאהבה, {{2}}`,
        example: {
          body_text: [['דנה', 'נטע פרטוש ורון אוטמזגין']],
        },
      },
    ],
  }

  return [invitation, reminder, event_day, thank_you]
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('WhatsApp Templates Setup\n')

  const existing = await fetchExistingTemplates()

  let imageHandle: string | null = null

  // Upload sample image only if invitation template doesn't exist yet
  if (!existing.has('rsvp_invitation')) {
    console.log('\nUploading sample image for invitation header…')
    imageHandle = await uploadSampleImage()
  } else {
    console.log('\nrsvp_invitation already exists — skipping image upload.')
  }

  const templates = buildTemplates(imageHandle)

  console.log('\nProcessing templates:\n')

  for (const tpl of templates) {
    const existingEntry = existing.get(tpl.name)

    if (existingEntry) {
      const statusLine = existingEntry.status === 'REJECTED' && existingEntry.rejected_reason
        ? `${existingEntry.status} — ${existingEntry.rejected_reason}`
        : existingEntry.status
      console.log(`  [${tpl.name}]  ${statusLine}  (already exists — skipped)`)
      continue
    }

    process.stdout.write(`  [${tpl.name}]  creating… `)
    try {
      await graphPost(`${WABA_ID}/message_templates`, {
        name:       tpl.name,
        category:   tpl.category,
        language:   tpl.language,
        components: tpl.components,
      })
      console.log('PENDING')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Error 100 subcode 2388102 means the template already exists
      if (msg.includes('2388102') || msg.includes('already exists')) {
        console.log('already exists')
      } else {
        console.log(`ERROR: ${msg}`)
      }
    }
  }

  console.log('\nDone. Wait for Meta to review the templates (usually a few minutes to hours).')
  console.log('Run again to check status, or visit Meta Business Manager > WhatsApp > Templates.\n')
}

main().catch((err) => {
  console.error('\nFatal error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
