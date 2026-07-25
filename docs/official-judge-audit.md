# AgriSense Official Judge Audit

Status: ACTIVE - evidence is still being collected. No score in this file is final until the VPS and user-browser gates pass.

## Authority

1. Koushik's latest instructions.
2. `Final/Agentic_AI_Hackathon_Final_Question.pdf`.
3. Executed tests and observable behavior on `https://rookiecoders.tech/`.
4. Approved implementation plans and prior reports.

The final-round PDF is the product and scoring authority. The separate event sources disagree on whether the main sprint is 8 or 24 hours; that schedule conflict does not change this product audit.

## Frozen organizer rubric

| Criterion | Points | Evidence required for full credit |
|---|---:|---|
| Agentic behavior | 20 | Real tool use, dependent multi-step planning, targeted missing-field recovery, and cross-session memory demonstrated end to end. |
| Scope and execution | 15 | Stable Tier 0 path from vague intake through a complete plan on the deployed target. |
| Accuracy and practicality | 20 | Actionable recommendations, correct and input-sensitive financial math, and retrieved/live grounding. |
| Knowledge base | 12 | Public-source corpus, RAG retrieval, provenance, and proof that retrieved values affect advice. |
| bdapps Payment Gateway | 10 | Sandbox/simulator CaaS checkout request/response, balance deduction, and receipt flow. A unit mock alone cannot earn full credit. |
| Explainability | 10 | Recommendations expose their farm inputs, retrieved values, and auditable tool trace without private chain-of-thought. |
| Technical implementation | 8 | Clean API/data integration, sound architecture, and passing tests at the important boundaries. |
| Innovation | 5 | Useful features beyond the working core, such as proactive adjustment, scenarios, image diagnosis, marketplace, or accessible Bangla voice. |

Official competition score and internal execution-readiness score remain separate. Neither score will be rounded up.

## Contract-to-plan delta

| Official contract | Current product direction | Decision |
|---|---|---|
| Farmer-facing core must be stable before bonus features. | Tier 1 and Tier 2 surfaces are present. | Re-prove all eight Tier 0 capabilities before awarding any bonus value. |
| Payment is a sandbox/simulator checkout with balance deduction and receipt. | The approved prototype uses one explicit BDT 5 payment during OTP enrollment, followed by password login without another OTP or charge. | Keep payment controls out of the farmer UI and validate the simulator flow separately. Never perform a real debit in automated stress. |
| Visible trace includes tool parameters and raw returned values. | Chat-native summarized activity is implemented. | Verify that expandable details retain sanitized parameters and returned measurements; presentation summaries alone are insufficient. |
| Bengali or voice is a Tier 2 accessibility bonus. | Natural Bangla and English UI modes, mixed-language input understanding, image, and Realtime voice are implemented locally. | Score only deployed, user-visible behavior; static presence is not enough. |
| README must identify real versus mock/generated features and APIs. | README now states the one-time payment, two-language UI, mixed-language input, and local/provider truth boundaries. | Keep the limitations synchronized with the final deployed evidence. |

## Defect ledger

| ID | Candidate | Initial state | Required evidence / exit condition |
|---|---|---|---|
| AUTH-LOGIN-01 | Returning subscriber is routed into registration instead of receiving a security OTP. | CONFIRMED, PATCHED locally | Unit/integration regression plus deployed Login request behavior without enrollment or charge. |
| BILL-IDEMP-01 | Daily BDT 5 access can duplicate a same-day debit under repeated/concurrent login. | CONFIRMED design gap, PATCHED locally | Parallel winner test proves one provider call and deterministic transaction ID; PostgreSQL constraint present. |
| BILL-UI-01 | Farmer dashboard exposes operator payment configuration. | CONFIRMED, PATCHED locally | Browser inspection and contract tests show only one-time access status; no operator link, token control, cancellation control, or recurring-payment workflow. |
| BILL-JUDGE-01 | Hiding farmer payment controls may remove the official checkout/balance/receipt proof. | UNRESOLVED | Protected simulator demo and sanitized receipt evidence, or an explicit official-score deduction. |
| VOICE-TEXT-01 | Transcript deltas are joined after trimming, causing words to run together; turns can share one buffer. | CONFIRMED, PATCHED locally | Focused delta/turn tests plus deployed voice UI event inspection. |
| VOICE-TONE-01 | Spoken responses sound robotic and interrupt Bangla pauses. | PARTLY CONFIRMED from user report | Official prompt/VAD contract, low-eagerness semantic VAD, and a real microphone acceptance pass; tone remains subjective until heard. |
| REG-01 | Full suite contains a brittle import-string assertion after the voice helper was added. | CONFIRMED, PATCHED locally | Full suite passes. |
| DOC-01 | README advertised stale passwordless, Banglish-mode, operator-console, and daily-access behavior. | CONFIRMED, PATCHED locally | README now matches the one-time enrollment and English/Bangla UI contract; final target evidence remains required. |
| TARGET-01 | Latest changes have not yet been proven on the VPS or clicked through in the signed-in user browser. | UNRESOLVED | Versioned deploy, health probes, reload, desktop/mobile UI, console, and exact demo/auth/payment paths. |

## Safety boundary

Automated stress may mock the bdapps provider and exercise idempotency, receipt, failure, retry, and concurrency behavior. It must not submit a live CaaS debit. A real sandbox debit is a separate manual approval-gated demonstration because it changes external account balance.
