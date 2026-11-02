import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'בקשת מחיקת מידע — אישורי הגעה',
}

export default function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-2xl space-y-8">

        <div>
          <Link href="/" className="text-sm text-muted transition hover:text-foreground">
            → חזרה לדף הבית
          </Link>
          <h1 className="mt-4 text-3xl font-bold">בקשת מחיקת מידע</h1>
          <p className="mt-1 text-sm text-muted">עדכון אחרון: נובמבר 2026</p>
        </div>

        <section className="space-y-3">
          <p className="text-sm leading-relaxed text-muted">
            על פי חוק הגנת הפרטיות, יש לך זכות לבקש מחיקה של פרטייך ממערכת אישורי ההגעה.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">איך לבקש מחיקה</h2>
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
              <p className="text-sm font-medium">אפשרות א׳ — פנייה לבעלי האירוע</p>
              <p className="text-sm text-muted leading-relaxed">
                פנה/י ישירות לבעל האירוע שהזמין אותך. הם יכולים למחוק את פרטייך מהרשימה באופן מיידי.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
              <p className="text-sm font-medium">אפשרות ב׳ — פנייה למפעיל המערכת</p>
              <p className="text-sm text-muted leading-relaxed">
                שלח/י אימייל ל{' '}
                <a href="mailto:galta851@gmail.com" className="text-accent underline underline-offset-2">
                  galta851@gmail.com
                </a>
                {' '}עם מספר הטלפון שבו הוזמנת. ציין/י גם את שם האירוע אם ידוע.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">מה קורה אחרי הבקשה</h2>
          <ul className="space-y-2 text-sm text-muted">
            <li className="flex gap-2">
              <span className="shrink-0 text-accent">•</span>
              <span>המחיקה תתבצע תוך <strong className="text-foreground">30 יום</strong> מקבלת הבקשה.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-accent">•</span>
              <span>יימחקו: שמך, מספר הטלפון, תשובת האישור, והיסטוריית ההודעות.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-accent">•</span>
              <span>לאחר המחיקה לא ישלחו אליך הודעות נוספות מהמערכת.</span>
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">מחיקה אוטומטית</h2>
          <p className="text-sm leading-relaxed text-muted">
            גם ללא בקשה, נתוני האירוע מיועדים למחיקה כ-60 יום לאחר תאריך האירוע.
          </p>
        </section>

        <footer className="border-t border-border pt-6 text-center text-xs text-muted">
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            מדיניות פרטיות
          </Link>
        </footer>
      </div>
    </main>
  )
}
