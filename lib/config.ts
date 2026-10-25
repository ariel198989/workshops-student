export const SB_URL = 'https://eaawnjvabcnznukewnlj.supabase.co';
export const SB_KEY = 'sb_publishable_tiGoGAebIqTF-gDldacKAw_IIlaYifh';

export const BUCKET = 'smartcity'; // frames, crops, models

/** Where staff accounts are sent: the instructor console is a separate app on the same Supabase project. */
const DEFAULT_CONSOLE_URL = 'https://workshops-os-murex.vercel.app';
export const consoleUrl = (configured: string | undefined): string => configured?.trim() || DEFAULT_CONSOLE_URL;
export const CONSOLE_URL = consoleUrl(process.env.NEXT_PUBLIC_CONSOLE_URL);

/** Stand-in location: lat/lng are NOT NULL in sc_detections and the kids are never asked for GPS. */
export const DEFAULT_CITY = { name: 'שדרות', center_lat: 31.525, center_lng: 34.597, zoom: 14.5 };
