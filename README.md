# Workshops Student

Standalone student app (Hebrew, RTL, mobile-first) for the Corewise computer-vision workshops.
Students sign up, join a workshop with a code, then capture, tag and train a model with their group,
and get a certificate at the end. Next 15, React 19, TypeScript, CSS Modules.

## Routes

`/` home, `/join`, `/capture`, `/tag`, `/train`, `/results`, `/certificate`, `/verify/[code]` (public).

## Run

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # node:test, pure logic only
npm run build
```

## Configuration

- `NEXT_PUBLIC_CONSOLE_URL`: where staff accounts are pointed (default `https://workshops-os-murex.vercel.app`).
- Supabase URL and publishable key live in `lib/config.ts` (same project as the console).

## Database

The Supabase project and every `ws_*` table, RPC and policy are owned by the instructor console repo
(`workshops-os`). Migrations live there only; this repo has none. Changes to a table or RPC used here
(`ws_whoami`, `ws_my_context`, `ws_verify_certificate`, `ws_certificates`, join RPCs) must be made there.

Photos, training jobs and models live in the workshops' own tables: `ws_photos`, `ws_training_jobs`,
`ws_models` (plus the RPCs `ws_tag_detection`, `ws_training_queue`, `ws_shared_model`). Files live in two
buckets: `ws-media` (private: photos at `w/{workshop}/g/{group}/p/`, dataset ZIPs at `.../jobs/`, shown
through signed links, see `lib/cv/signed-url.ts`) and `ws-models` (model ZIPs, public by URL).
