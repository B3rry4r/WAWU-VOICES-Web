# VOICES website (usevoices.com)

Next.js 14 (App Router), TypeScript, Tailwind, vitest. The API is `B3rry4r/WAWU-VOICES-Backend`. `contract/openapi.yaml`
is copied from the API repo (`docs/contract/openapi.yaml`); `npm run api:types` regenerates `src/lib/api/types.ts`
(never hand-edit it).

## The owner's standing rules (14 Nov 2026, the owner's own words; read these first, every session)

1. **Nothing waits.** "Nothing should ever wait again." "Everything goes to deployment immediately with immediate
   effect." A finished piece is released at once, server side first. Checks run alongside and what they find is fixed
   forward.
2. **Nothing is put before or after a launch, parked, held or queued for later unless the owner says so.** "Nothing
   should ever pre-launch, after launch again, except I say it is so."
3. **No decision without the owner.** "Never you take a decision without me." What people see, what they can do, when
   something opens and what is left out are the owner's calls: ask with a simple click question, recommended choice
   first.
4. **The record screen is never broken.** The pick-one-word screen for today's question (`src/features/speak/`: the
   question, "Pick one word", the words, "Say it in N seconds", "Type it instead", "Share my word") must always work.
   Do not change how it looks or works unless the owner asks. Nothing is released that touches it without proof it
   still works, and the live screen is checked after every release.
5. **Talk to the owner in plain, short, everyday English.** No builder, checker, branch, pull request or test talk.
   Do not lecture about website or server security.

Why these exist: on launch day a release was built around a midnight opening and then held for checks while people
were already arriving. They met "This question has closed" and could not record.

## Working rules

- Tailwind classes and tokens only: no inline styles, no hard-coded colours. Shared UI lives in `src/components/vx`;
  never fork a component, add a prop.
- All API calls go through `src/lib/api/`. A writer drops its Idempotency-Key only after success or when the server
  asks for a new one (`needsNewKey` in `src/lib/api/keys.ts`).
- Never `git stash`, `git reset --hard`, `git checkout -- .`, rebase, amend or force-push. Never `git add -A`.
- Never edit a test assertion to make it pass unless a recorded ruling or an owner order changes the rule it tests.
- No em-dashes in anything a person reads. The word "Rant" never appears. Contact is support@wawuafrica.com.
- Lead records: `docs/lead/reports/`.
