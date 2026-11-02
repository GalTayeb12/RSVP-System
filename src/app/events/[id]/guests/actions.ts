'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/phone'

export type GuestData = {
  first_name: string
  last_name: string
  phone: string
  side: 'groom' | 'bride' | 'shared'
  group_name: string | null
  invited_count: number
  note: string | null
}

export type GuestActionResult =
  | { success: true }
  | { error: string }
  | { duplicate: { id: string; name: string } }

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getAccessibleClient(eventId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  // RLS verifies access — if the query returns nothing, user has no access
  const { data } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .maybeSingle()
  return data ? supabase : null
}

// ─── Add ─────────────────────────────────────────────────────────────────────

export async function addGuest(
  eventId: string,
  data: GuestData,
): Promise<GuestActionResult> {
  const supabase = await getAccessibleClient(eventId)
  if (!supabase) return { error: 'אין גישה לאירוע' }

  if (!data.first_name.trim()) return { error: 'שם פרטי הוא שדה חובה' }
  if (!['groom', 'bride', 'shared'].includes(data.side))
    return { error: 'יש לבחור צד' }

  const phoneResult = normalizePhone(data.phone)
  if ('error' in phoneResult) return { error: phoneResult.error }

  // Check duplicate
  const { data: existing } = await supabase
    .from('guests')
    .select('id, first_name, last_name')
    .eq('event_id', eventId)
    .eq('phone', phoneResult.phone)
    .maybeSingle()

  if (existing) {
    return {
      duplicate: {
        id: existing.id,
        name: [existing.first_name, existing.last_name].filter(Boolean).join(' '),
      },
    }
  }

  const { error } = await supabase.from('guests').insert({
    event_id: eventId,
    first_name: data.first_name.trim(),
    last_name: data.last_name.trim() || null,
    phone: phoneResult.phone,
    side: data.side,
    group_name: data.group_name?.trim() || null,
    invited_count: data.invited_count,
    note: data.note?.trim() || null,
  })

  if (error) return { error: `שגיאה בשמירה: ${error.message}` }

  revalidatePath(`/events/${eventId}/guests`)
  return { success: true }
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updateGuest(
  guestId: string,
  eventId: string,
  data: GuestData,
): Promise<GuestActionResult> {
  const supabase = await getAccessibleClient(eventId)
  if (!supabase) return { error: 'אין גישה לאירוע' }

  if (!data.first_name.trim()) return { error: 'שם פרטי הוא שדה חובה' }

  const phoneResult = normalizePhone(data.phone)
  if ('error' in phoneResult) return { error: phoneResult.error }

  // Check duplicate (exclude current guest)
  const { data: existing } = await supabase
    .from('guests')
    .select('id, first_name, last_name')
    .eq('event_id', eventId)
    .eq('phone', phoneResult.phone)
    .neq('id', guestId)
    .maybeSingle()

  if (existing) {
    return {
      duplicate: {
        id: existing.id,
        name: [existing.first_name, existing.last_name].filter(Boolean).join(' '),
      },
    }
  }

  const { error } = await supabase
    .from('guests')
    .update({
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim() || null,
      phone: phoneResult.phone,
      side: data.side,
      group_name: data.group_name?.trim() || null,
      invited_count: data.invited_count,
      note: data.note?.trim() || null,
    })
    .eq('id', guestId)
    .eq('event_id', eventId)

  if (error) return { error: `שגיאה בשמירה: ${error.message}` }

  revalidatePath(`/events/${eventId}/guests`)
  return { success: true }
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export async function deleteGuest(
  guestId: string,
  eventId: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await getAccessibleClient(eventId)
  if (!supabase) return { error: 'אין גישה לאירוע' }

  const { error } = await supabase
    .from('guests')
    .delete()
    .eq('id', guestId)
    .eq('event_id', eventId)

  if (error) return { error: `שגיאה במחיקה: ${error.message}` }

  revalidatePath(`/events/${eventId}/guests`)
  return { success: true }
}

// ─── Bulk import ─────────────────────────────────────────────────────────────

export async function importGuests(
  eventId: string,
  guests: GuestData[],
): Promise<{ imported: number; error?: string }> {
  const supabase = await getAccessibleClient(eventId)
  if (!supabase) return { imported: 0, error: 'אין גישה לאירוע' }
  if (!guests.length) return { imported: 0 }

  const rows = guests.map((g) => ({
    event_id: eventId,
    first_name: g.first_name.trim(),
    last_name: g.last_name.trim() || null,
    phone: g.phone, // already normalized E.164
    side: g.side,
    group_name: g.group_name?.trim() || null,
    invited_count: g.invited_count,
    note: g.note?.trim() || null,
  }))

  // Insert in chunks to avoid request-size limits
  const CHUNK = 200
  let imported = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase
      .from('guests')
      .insert(rows.slice(i, i + CHUNK))
    if (error) return { imported, error: `שגיאה ביבוא: ${error.message}` }
    imported += rows.slice(i, i + CHUNK).length
  }

  revalidatePath(`/events/${eventId}/guests`)
  return { imported }
}
