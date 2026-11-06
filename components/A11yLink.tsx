import Link from 'next/link';

export const A11Y_PATH = '/accessibility';

/** The accessibility statement, reachable from every screen (IS 5568 / the 2013 service regulations). */
export function A11yLink() {
  return (
    <footer className="a11y-foot">
      <Link href={A11Y_PATH}>הצהרת נגישות</Link>
    </footer>
  );
}
