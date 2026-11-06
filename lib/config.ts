export const SB_URL = 'https://eaawnjvabcnznukewnlj.supabase.co';
export const SB_KEY = 'sb_publishable_tiGoGAebIqTF-gDldacKAw_IIlaYifh';

/** The workshops' own storage. ws-media is PRIVATE (photos, dataset ZIPs): signed links or an authenticated download only. */
export const MEDIA_BUCKET = 'ws-media';
/** Trained model ZIPs: public by URL, so the take-home page loads a model without an account. */
export const MODELS_BUCKET = 'ws-models';

/** Where staff accounts are sent: the instructor console is a separate app on the same Supabase project. */
const DEFAULT_CONSOLE_URL = 'https://workshops-os-murex.vercel.app';
export const consoleUrl = (configured: string | undefined): string => configured?.trim() || DEFAULT_CONSOLE_URL;
export const CONSOLE_URL = consoleUrl(process.env.NEXT_PUBLIC_CONSOLE_URL);
