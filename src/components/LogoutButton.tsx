'use client'

import { logout } from '@/app/actions'

export default function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="text-sm text-muted hover:text-foreground transition-colors"
      >
        התנתקות
      </button>
    </form>
  )
}
