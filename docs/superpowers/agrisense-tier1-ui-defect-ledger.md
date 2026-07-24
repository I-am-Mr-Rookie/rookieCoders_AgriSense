# AgriSense Tier 1 UI Defect Ledger

| ID | Observable failure | Root cause | Baseline evidence | State | Required regression |
|---|---|---|---|---|---|
| UI-01 | Dark mode contains a glaring light recommendation box. | `.best` uses the legacy hardcoded `#edf3eb` background instead of theme tokens. | User screenshot plus computed style `rgb(237, 243, 235)` against dark body `rgb(7, 17, 12)`. | COMPLETE | Browser computed dark `.best` gradient `rgb(23, 63, 44)` to `rgb(22, 51, 37)` with cream text; light mode uses a separate warm gradient. |
| UI-02 | Fertilizer evidence renders the same BARC PDF link three times. | The UI maps distinct evidence records directly even when they share one source URL. | User screenshot plus DOM audit showing three identical links inside the fertilizer card. | COMPLETE | Browser probe found exactly one matching BARC PDF link in the fertilizer card while its grouped records remain expandable. |
| UI-03 | Agent activity appears in a separate lower panel after the answer. | Activity and conversation are modeled and rendered independently. | DOM/source inspection shows `ActivityFeed` below the main layout; a local demo completed before a 600 ms observation. | COMPLETE | Browser observed one in-chat run, sequential steps while busy, then `Plan completed · 11 steps · 4.9s`; collapsed/reopen behavior and same-message Markdown passed. |
| UI-04 | Typography and theming feel inconsistent across legacy and Tier 1 surfaces. | Inter is referenced but not bundled; layered CSS retains hardcoded component colors and mixed visual rules. | Browser computed styles and stylesheet inspection. | COMPLETE | Local Newsreader/Anek assets built; System/Light/Dark, 1280px and 390px layouts, zero horizontal overflow, and zero browser console warnings/errors passed. |

Raw reports: 4. Unique confirmed defects: 4. Current campaign spend: USD 0.00.

## Final verification

- Focused visual contract: 19/19 passed.
- Full `npm run check`: 132/132 tests plus production build passed.
- `npm audit --omit=dev`: 0 vulnerabilities.
- Signed-in in-app browser: dark, light, system, demo pacing, collapse/reopen, grouped evidence, Markdown, 390px responsive layout, and console checked.
- Independent subagent quality review was attempted after spec approval but blocked by the external Codex usage limit; the final changed surface was reviewed locally and exercised through the full automated and browser gates.
