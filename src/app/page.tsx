const steps = [
  { title: "מעלים מוזמנים", text: "מקובץ אקסל או ידנית, אחד אחד." },
  { title: "שולחים הזמנה", text: "הודעה אישית בוואטסאפ לכל מוזמן." },
  { title: "רואים מי מגיע", text: "דשבורד שמתעדכן עם כל תשובה." },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl text-center">
        <p className="text-sm font-medium tracking-wide text-accent">
          ניהול אישורי הגעה
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
          כל המוזמנים שלכם, במקום אחד
        </h1>
        <p className="mt-4 text-lg text-muted">
          בלי טבלאות מפוזרות ובלי טלפונים מביכים. יודעים בדיוק כמה מגיעים.
        </p>

        <a
          href="/login"
          className="mt-8 inline-block rounded-full bg-foreground px-8 py-3 text-base font-medium text-background transition hover:opacity-90"
        >
          כניסה למערכת
        </a>

        <ol className="mt-14 grid gap-4 text-right sm:grid-cols-3">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <span className="text-sm font-semibold text-accent">
                {i + 1}
              </span>
              <h2 className="mt-1 font-semibold">{step.title}</h2>
              <p className="mt-1 text-sm text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
