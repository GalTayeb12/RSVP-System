import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'מדיניות פרטיות — אישורי הגעה',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-2xl space-y-8">

        <div>
          <Link href="/" className="text-sm text-muted transition hover:text-foreground">
            → חזרה לדף הבית
          </Link>
          <h1 className="mt-4 text-3xl font-bold">מדיניות פרטיות</h1>
          <p className="mt-1 text-sm text-muted">עדכון אחרון: נובמבר 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">מי אנחנו</h2>
          <p className="text-sm leading-relaxed text-muted">
            מערכת אישורי הגעה היא שירות לניהול מוזמנים לאירועים פרטיים (חתונות, בר/בת מצווה וכדומה).
            השירות מופעל על ידי גל טייב.
            ליצירת קשר:{' '}
            <a href="mailto:galta851@gmail.com" className="text-accent underline underline-offset-2">
              galta851@gmail.com
            </a>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">מה נאסף ולמה</h2>
          <p className="text-sm leading-relaxed text-muted">
            המידע נאסף אך ורק לצורך ניהול אישורי הגעה לאירוע עבור בעלי האירוע:
          </p>
          <ul className="space-y-2 text-sm text-muted">
            <li className="flex gap-2">
              <span className="shrink-0 text-accent">•</span>
              <span><strong className="text-foreground">שם פרטי ושם משפחה</strong> — לזיהוי המוזמן ולפנייה אישית בהודעה.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-accent">•</span>
              <span><strong className="text-foreground">מספר טלפון</strong> — לשליחת הזמנה ועדכונים בוואטסאפ.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-accent">•</span>
              <span><strong className="text-foreground">תשובת אישור הגעה</strong> — האם המוזמן מגיע, מספר המגיעים, ותשובות לשאלות נוספות שקבעו בעלי האירוע (כגון בחירת מנה, צורך בהסעה).</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-accent">•</span>
              <span><strong className="text-foreground">היסטוריית תשובות</strong> — תיעוד שינויים בתשובת האישור.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-accent">•</span>
              <span><strong className="text-foreground">סטטוס הודעות</strong> — אישורי נשלח/נמסר/נקרא מ-Meta (WhatsApp) לצורך מעקב.</span>
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">איפה המידע נשמר</h2>
          <p className="text-sm leading-relaxed text-muted">
            המידע מאוחסן ב-Supabase, שירות בסיס נתונים מבוסס ענן עם שרתים באיחוד האירופי (eu-central-1).
            שירות Supabase עומד בתקן GDPR.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">מי רואה את המידע</h2>
          <p className="text-sm leading-relaxed text-muted">
            המידע נגיש רק לבעלי האירוע ולאנשים שהם הוסיפו בעצמם (למשל: הורים שמסייעים בניהול הרשימה).
            מפעיל המערכת יכול לגשת למידע לצורך תמיכה טכנית בלבד.
            המידע לא נמכר ולא מועבר לצד שלישי כלשהו, למעט Meta Platforms לצורך שליחת ההודעות (ראו להלן).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">שליחת הודעות דרך WhatsApp</h2>
          <p className="text-sm leading-relaxed text-muted">
            הודעות נשלחות דרך WhatsApp Business Platform של Meta Platforms, Inc.
            לצורך שליחת ההודעה, מועבר לMeta מספר הטלפון ותוכן ההודעה בלבד.
            Meta כפופה למדיניות הפרטיות שלה הנפרדת.
            בעלי האירוע אחראים לוודא שיש הסכמה לקבלת הודעות לפני השליחה.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">הסרה מהודעות</h2>
          <p className="text-sm leading-relaxed text-muted">
            בכל עת ניתן להסיר את עצמך מרשימת ההודעות בשתי דרכים:
          </p>
          <ul className="space-y-2 text-sm text-muted">
            <li className="flex gap-2">
              <span className="shrink-0 text-accent">•</span>
              <span>כתיבת <strong className="text-foreground">"הסר"</strong> בתשובה להודעת הוואטסאפ שקיבלת.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-accent">•</span>
              <span>לחיצה על קישור ההסרה בדף האישור האישי שלך.</span>
            </li>
          </ul>
          <p className="text-sm leading-relaxed text-muted">
            לאחר הסרה לא ישלחו הודעות נוספות מהמערכת לגבי אותו אירוע.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">מחיקת נתונים</h2>
          <p className="text-sm leading-relaxed text-muted">
            נתוני האירוע (כולל פרטי המוזמנים) מיועדים למחיקה כ-60 יום לאחר תאריך האירוע.
            לבקשת מחיקה מוקדמת, ראו את{' '}
            <Link href="/data-deletion" className="text-accent underline underline-offset-2">
              דף בקשת מחיקת מידע
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">יצירת קשר</h2>
          <p className="text-sm leading-relaxed text-muted">
            לכל שאלה בנושא פרטיות:{' '}
            <a href="mailto:galta851@gmail.com" className="text-accent underline underline-offset-2">
              galta851@gmail.com
            </a>
          </p>
        </section>

        <footer className="border-t border-border pt-6 text-center text-xs text-muted">
          <Link href="/data-deletion" className="underline underline-offset-2 hover:text-foreground">
            בקשת מחיקת מידע
          </Link>
        </footer>
      </div>
    </main>
  )
}
