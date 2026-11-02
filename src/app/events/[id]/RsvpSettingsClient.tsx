'use client'

import { useState, useTransition } from 'react'
import type { RsvpSettings, MealOption } from '@/lib/rsvp-settings'
import { updateRsvpSettings } from './actions'

type Props = {
  eventId: string
  initialSettings: RsvpSettings
}

export default function RsvpSettingsClient({ eventId, initialSettings }: Props) {
  const [settings, setSettings] = useState<RsvpSettings>(initialSettings)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // Meal option editing
  const [newMealLabel, setNewMealLabel] = useState('')

  // Pickup point editing
  const [newPickupPoint, setNewPickupPoint] = useState('')

  function toggle(key: 'meals' | 'transport' | 'free_note') {
    setSaved(false)
    setSettings((s) => ({
      ...s,
      [key]: { ...s[key], enabled: !s[key].enabled },
    }))
  }

  function addMealOption() {
    const label = newMealLabel.trim()
    if (!label) return
    const id = label
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_\u0590-\u05ff]/g, '')
      || String(Date.now())
    setSaved(false)
    setSettings((s) => ({
      ...s,
      meals: {
        ...s.meals,
        options: [...s.meals.options, { id, label }],
      },
    }))
    setNewMealLabel('')
  }

  function removeMealOption(id: string) {
    setSaved(false)
    setSettings((s) => ({
      ...s,
      meals: {
        ...s.meals,
        options: s.meals.options.filter((o) => o.id !== id),
      },
    }))
  }

  function updateMealLabel(id: string, label: string) {
    setSaved(false)
    setSettings((s) => ({
      ...s,
      meals: {
        ...s.meals,
        options: s.meals.options.map((o): MealOption =>
          o.id === id ? { ...o, label } : o,
        ),
      },
    }))
  }

  function addPickupPoint() {
    const pt = newPickupPoint.trim()
    if (!pt) return
    setSaved(false)
    setSettings((s) => ({
      ...s,
      transport: {
        ...s.transport,
        pickup_points: [...s.transport.pickup_points, pt],
      },
    }))
    setNewPickupPoint('')
  }

  function removePickupPoint(pt: string) {
    setSaved(false)
    setSettings((s) => ({
      ...s,
      transport: {
        ...s.transport,
        pickup_points: s.transport.pickup_points.filter((p) => p !== pt),
      },
    }))
  }

  function handleSave() {
    setError('')
    setSaved(false)
    startTransition(async () => {
      const result = await updateRsvpSettings(eventId, settings)
      if ('error' in result) setError(result.error)
      else setSaved(true)
    })
  }

  const inputCls =
    'rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent'

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">שאלות לאישור הגעה</h3>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
        >
          {saved ? '✓ נשמר' : isPending ? 'שומר…' : 'שמור שינויים'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Meals section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.meals.enabled}
              onChange={() => toggle('meals')}
              className="h-4 w-4 rounded border-border text-accent"
            />
            <span className="text-sm font-medium">שאלת מנות</span>
          </label>
        </div>
        {settings.meals.enabled && (
          <div className="mr-6 space-y-2">
            {settings.meals.options.map((opt) => (
              <div key={opt.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt.label}
                  onChange={(e) => updateMealLabel(opt.id, e.target.value)}
                  className={`flex-1 ${inputCls}`}
                />
                <button
                  onClick={() => removeMealOption(opt.id)}
                  className="text-muted transition hover:text-red-600"
                  title="הסר"
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newMealLabel}
                onChange={(e) => setNewMealLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addMealOption()}
                placeholder="שם מנה חדשה…"
                className={`flex-1 ${inputCls}`}
              />
              <button
                onClick={addMealOption}
                disabled={!newMealLabel.trim()}
                className="rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-background disabled:opacity-40"
              >
                + הוסף
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transport section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.transport.enabled}
              onChange={() => toggle('transport')}
              className="h-4 w-4 rounded border-border text-accent"
            />
            <span className="text-sm font-medium">שאלת הסעה</span>
          </label>
        </div>
        {settings.transport.enabled && (
          <div className="mr-6 space-y-2">
            <p className="text-xs text-muted">נקודות איסוף</p>
            {settings.transport.pickup_points.map((pt) => (
              <div key={pt} className="flex items-center gap-2">
                <span className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  {pt}
                </span>
                <button
                  onClick={() => removePickupPoint(pt)}
                  className="text-muted transition hover:text-red-600"
                  title="הסר"
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newPickupPoint}
                onChange={(e) => setNewPickupPoint(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPickupPoint()}
                placeholder="נקודת איסוף חדשה…"
                className={`flex-1 ${inputCls}`}
              />
              <button
                onClick={addPickupPoint}
                disabled={!newPickupPoint.trim()}
                className="rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-background disabled:opacity-40"
              >
                + הוסף
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Free note section */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.free_note.enabled}
            onChange={() => toggle('free_note')}
            className="h-4 w-4 rounded border-border text-accent"
          />
          <span className="text-sm font-medium">שדה הערה חופשית</span>
        </label>
      </div>
    </div>
  )
}
