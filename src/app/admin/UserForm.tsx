'use client'

import { useState, useTransition } from 'react'
import { createUser } from './actions'

type State = { error?: string; success?: boolean }

export default function UserForm() {
  const [isPending, startTransition] = useTransition()
  const [state, setState] = useState<State>({})
  const [formKey, setFormKey] = useState(0)

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createUser({}, formData)
      setState(result)
      if (result.success) setFormKey((k) => k + 1)
    })
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-4 font-semibold">הוספת משתמש חדש</h3>

      {state.success && (
        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          המשתמש נוצר בהצלחה
        </p>
      )}
      {state.error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <form key={formKey} action={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="username"
              className="mb-1.5 block text-sm font-medium"
            >
              שם משתמש
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label
              htmlFor="full_name"
              className="mb-1.5 block text-sm font-medium"
            >
              שם מלא
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label
              htmlFor="user-password"
              className="mb-1.5 block text-sm font-medium"
            >
              סיסמה (לפחות 8 תווים)
            </label>
            <input
              id="user-password"
              name="password"
              type="password"
              minLength={8}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label htmlFor="role" className="mb-1.5 block text-sm font-medium">
              תפקיד
            </label>
            <select
              id="role"
              name="role"
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="owner">זוג (owner)</option>
              <option value="helper">עוזר (helper)</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-foreground px-5 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'שומר…' : 'יצירת משתמש'}
        </button>
      </form>
    </div>
  )
}
