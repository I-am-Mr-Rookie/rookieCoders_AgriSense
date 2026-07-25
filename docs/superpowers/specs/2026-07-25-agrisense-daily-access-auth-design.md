# AgriSense Daily Access and Secure Login Design

## Approved behavior

AgriSense separates mobile subscription enrollment from returning-user security. Sign Up checks bdapps subscription state, requests the provider enrollment OTP only for an unregistered number, verifies it, then establishes the farmer account. Login checks that the number is registered, sends an application-generated one-time code through the protected bdapps SMS endpoint, verifies the hashed short-lived challenge, and never re-enrolls the subscriber.

Access costs BDT 5 per Asia/Dhaka calendar day. A deterministic transaction ID derived from the user and date makes every retry idempotent. A successful daily ledger entry grants access for that date; the same farmer can log in repeatedly without another debit. Provider failures do not create a paid entitlement. Automated tests use fake gateways and never submit a live debit.

## Farmer interface

The farmer never sees the operator payment dashboard, gateway configuration, API terminology, or transaction controls. The workspace shows a compact “Today’s access” surface with the BDT 5/day price, paid/pending state, and one Cancel subscription action. Cancellation requires an authenticated session, operates only on the session-bound encrypted mobile, and confirms before unsubscribing.

## Security and persistence

- Raw OTPs are never stored; login challenges persist as HMAC hashes with a five-minute expiry, attempt limit, and one-time consumption.
- The normalized mobile is encrypted at rest with an AES-GCM key derived from `AUTH_SESSION_SECRET`; existing mobile hashes remain the lookup identity.
- PostgreSQL stores login challenges, daily entitlements, and encrypted subscriber identity.
- Signup/login mismatch errors direct the farmer to the correct action without leaking account details beyond the submitted number.
- Daily debit tests are mocked. Production debit activation remains an environment-controlled operational setting.

## Voice quality

Realtime voice uses natural short Bangla/Banglish turns, semantic turn detection, near-field noise reduction, and explicit confirmation of unclear numbers or agricultural terms. Partial assistant transcript deltas are accumulated in order and replaced only by the final transcript, preventing jumbled background text.

## Acceptance

Returning registered users receive login OTPs without provider enrollment errors or subscription charges. New users complete provider enrollment. Same-day repeated logins cannot create a second daily charge. The user dashboard contains no operator link and exposes only daily status plus cancellation. Focused, full, VPS, mobile, and signed-in browser checks reach at least 95/100 on the frozen readiness rubric.
