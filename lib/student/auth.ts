import { initAuth } from '../auth';
import { sb } from '../db';
import { signupErrorMessage, type SignupInput } from './labels';

/** Error whose message is already safe, Hebrew copy for the student. */
export class SignupError extends Error {}

/** Creates the account (auto-confirmed) and signs the student in. Throws SignupError with Hebrew text. */
export async function studentSignup({ fullName, email, password }: SignupInput): Promise<void> {
  const { data, error } = await sb.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: fullName.trim() } },
  });
  if (error) throw new SignupError(signupErrorMessage(error));
  if (!data.session) throw new SignupError('ההרשמה נקלטה, אבל לא הצלחנו להכניס אתכם. נסו להיכנס בלשונית הכניסה');
  await initAuth();
}
