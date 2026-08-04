# Contributing to AgriSense

Thanks for helping make practical agricultural software more useful and safer.

## Before opening a change

1. Explain the user problem and the smallest change that addresses it.
2. Keep provider calls, credentials, and payment operations server-side.
3. Preserve provenance for new agriculture records: source, reference/page, category, confidence, and retrieval date where available.
4. Add or update a focused test for behavior changes.
5. Run the repository checks before opening a pull request:

   ```powershell
   npm.cmd run check
   npm.cmd audit --omit=dev
   git diff --check
   ```

## Product conventions

- Treat retrieved facts, team assumptions, and model-generated text as different things in both code and copy.
- Never expose private chain-of-thought. Bounded tool activity and API-provided summaries are enough for user trust.
- Do not recommend a chemical without current official registry evidence.
- Keep English and Bangla copy short, natural, and usable on Android screens.
- Preserve visible keyboard focus and a complete `prefers-reduced-motion` path.

## Pull requests

Use a descriptive title, include the verification commands you ran, and call out any provider-backed or manual checks that were intentionally not performed. Never include secrets, real OTPs, payment credentials, private farmer data, or production database URLs.
