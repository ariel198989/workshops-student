import type { Metadata } from 'next';
import Link from 'next/link';
import a from './accessibility.module.css';

// Public, no sign-in (lib/student/access.ts isPublicPath). Text: knowledge/workshops/accessibility-statement-he.md,
// section "הטקסט"; the bracketed fields wait for the accessibility coordinator's details and stay as they are.
export const metadata: Metadata = { title: 'הצהרת נגישות · Workshops Student · Corewise' };

export default function AccessibilityPage() {
  return (
    <main className={a.page}>
      <h1>הצהרת נגישות</h1>
      <p>
        אנחנו רוצים שכל ילדה וכל ילד יוכלו להשתתף בסדנה, גם בעזרת טכנולוגיה מסייעת. האפליקציה נבנתה לפי התקן הישראלי
        ת&quot;י 5568 (המבוסס על הנחיות WCAG 2.0 ברמה AA) ותקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות
        לשירות), התשע&quot;ג-2013.
      </p>

      <h2>מה עשינו</h2>
      <ul>
        <li>כל המסכים בעברית מימין לשמאל, עם כותרות מסודרות וסדר מעבר הגיוני במקלדת.</li>
        <li>כפתורים בגודל 44 פיקסלים לפחות, ניגודיות צבעים לפי AA, ותוויות לקוראי מסך.</li>
        <li>אפשר להגדיל את הטקסט עד 200% בלי לאבד תוכן.</li>
        <li>הודעות שגיאה כתובות במילים, לא רק בצבע.</li>
        <li>האפליקציה מכבדת הגדרה של &quot;הפחתת תנועה&quot; במכשיר.</li>
      </ul>

      <h2>מה עדיין לא נגיש במלואו</h2>
      <ul>
        <li>
          מסך הצילום והסימון על התמונה דורשים ראייה ותנועת יד. בסדנה, המדריך או חבר לקבוצה יכולים לבצע את הצילום
          והסימון יחד עם התלמיד, והתלמיד בוחר את התווית.
        </li>
        <li>גרפים של תוצאות המודל מוצגים גם כטקסט, אבל חלק מהתרשימים עדיין ללא תיאור מלא.</li>
      </ul>

      <p><b>תאריך הבדיקה האחרונה:</b> [תאריך]</p>
      <p>
        <b>רכז/ת נגישות:</b> [שם], [טלפון], [דוא&quot;ל]. אפשר לפנות אלינו בכל בעיה, ונחזור תוך [X] ימי עבודה.
      </p>

      <Link href="/" className={a.back}>חזרה לאפליקציה</Link>
    </main>
  );
}
