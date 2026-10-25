'use client';
import { logout } from '@/lib/auth';
import { CONSOLE_URL } from '@/lib/config';

/** Shown to staff accounts that have no student side: this app is for students, the console is elsewhere. */
export function StaffNotice({ onPreview }: { onPreview: () => void }) {
  return (
    <div className="center-screen">
      <div className="hud denied">
        <h1>זה האזור של התלמידים</h1>
        <p className="muted">
          הקונסולה של הצוות נמצאת <a href={CONSOLE_URL}>כאן</a>
        </p>
        <div className="page-actions">
          <button type="button" className="primary" onClick={onPreview}>להמשיך כאן לצפייה</button>
          <button type="button" onClick={() => void logout()}>התנתקות</button>
        </div>
      </div>
    </div>
  );
}
