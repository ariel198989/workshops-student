import Link from 'next/link';
import styles from './dash.module.css';

const STEPS = [
  { href: '/orgs', title: 'צרו ארגון', text: 'בית ספר, חברה או רשות שעבורם מקיימים את הסדנה.' },
  { href: '/workshops/new', title: 'צרו סדנה', text: 'בחרו תבנית, תאריכים וגודל קבוצה. המפגשים נוצרים לבד.' },
  { href: '/workshops', title: 'פתחו את הסדנה', text: 'עברו למצב חי ותנו לתלמידים להירשם ב-Smart City.' },
] as const;

/** First-run guide shown to admins when there are no organizations and no workshops yet. */
export function DashboardOnboarding() {
  return (
    <section className={styles.section} aria-labelledby="dash-onboarding">
      <div className={styles.intro}>
        <h2 id="dash-onboarding">ברוכים הבאים ל-Workshops OS</h2>
        <p>שלושה צעדים עד לסדנה הראשונה.</p>
      </div>
      <ol className={styles.steps}>
        {STEPS.map((s, i) => (
          <li key={s.href}>
            <Link href={s.href} className={styles.step}>
              <span className={styles.stepNo}>{i + 1}</span>
              <span className={styles.stepTitle}>{s.title}</span>
              <span className={styles.stepText}>{s.text}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
