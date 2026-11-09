# VOICES web

The VOICES website (Next.js 14): Nigeria’s national conversation. The API, the rulings (`DECISIONS.md`), the tasks,
the contract, the deploy scripts and the legal texts’ master copies live in
[B3rry4r/WAWU-VOICES-Backend](https://github.com/B3rry4r/WAWU-VOICES-Backend). Read its `README.md`, `DECISIONS.md`,
`docs/WORKFLOW.md` and `tasks/README.md` before working here.

The two repos were one until 8 Nov 2026; the full joint history is on the backend repo’s `archive/monorepo` branch.

## Run
```
npm ci
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1 npm run dev
```
Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Copies of backend files
These are copies; the backend repo is the master. After one changes there, run
`VOICES_BACKEND_DIR=../wawu-voices-backend npm run sync:shared` (add `-- --check` to only compare):
- `content/legal/{terms,privacy,refunds}.md` (the legal pages, read at build time)
- `contract/openapi.yaml` (for `npm run api:types`, which writes `src/lib/api/types.ts`)
- `e2e/vendor/{normalise,limits}.ts` (the audio helper the recording e2e test uses)

## Deploy
Pushing to `main` runs `.github/workflows/deploy.yml`: tests, then rsync to `/srv/voices/web` on the droplet and
`deploy.sh web` (placed by the backend repo’s deploy, so deploy the backend first). Repository secrets needed, the same
as the backend repo: `VOICES_SSH_KEY`, `VOICES_HOST_KEY`, `VOICES_HOST`, `VOICES_DOMAIN`.
