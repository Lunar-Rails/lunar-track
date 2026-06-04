---
phase: codebase
slug: retroactive-audit
status: draft
threats_open: 2
asvs_level: 1
created: 2026-06-04
register_authored_at_plan_time: false
---

# Codebase — Security (Retroactive STRIDE)

> Retroactive security audit (2026-06-04). No phase `PLAN.md` `<threat_model>` exists; register built from implementation, `.planning/codebase/CONCERNS.md`, and `.planning/REVIEW.md` (CR-01–CR-15, WR-05–WR-09). Mitigations verified with grep/file:line evidence only.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser ↔ Next.js App Router | Google OAuth / magic-link session via Supabase SSR cookies (`@supabase/ssr`) | JWT session, profile id, PII in pages |
| Server Actions ↔ Supabase (user JWT) | `'use server'` mutations and RSC reads with anon key + RLS | Check-ins, scores, OKRs, profiles, org_closure |
| Netlify scheduled functions ↔ Supabase | `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS | All `profiles` rows (filtered in code), check-in status, `reminder_log` |
| Next.js ↔ Mailtrap | `src/lib/notifications.ts`, `email-reminders.mts` | Names, emails, check-in deep links (HTML) |
| Next.js / Netlify ↔ Slack | `src/lib/slack.ts`, `slack-reminders.mts` | Email lookup, DM content, workspace bot tokens |
| Next.js ↔ OpenAI | `extractReviewWithLLM` in `historical-review-actions.ts` | Manager-pasted review text (PII), model JSON output |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation (expected) | Status |
|-----------|----------|-----------|-------------|----------------------|--------|
| T-CB-01 | Tampering | `src/app/auth/callback/route.ts` | mitigate | Validate `next` as same-origin relative path only | **closed** |
| T-CB-02 | Elevation | Domain allowlist TS vs SQL | mitigate | Single whitelist; `clovrlabs.com` in both | **open** |
| T-CB-03 | Elevation | `getOrProvisionProfile` fallback | mitigate | `isAllowedEmail()` before direct `profiles` insert | **closed** |
| T-CB-04 | Elevation | Auth callback provisioning | mitigate | Fail closed on `upsert_profile_on_login` error (sign out + error redirect) | **closed** |
| T-CB-05 | Tampering / Denial | Edge request gate (`src/proxy.ts`) | mitigate | Runnable Next middleware + first-check-in gate | **open** |
| T-CB-06 | Elevation | `profiles` RLS self-update | mitigate | `profiles_self_update_meta` preserves `role` on UPDATE | **closed** |
| T-CB-07 | Spoofing / DoS | Netlify reminder HTTP handlers | mitigate | Require `REMINDER_SECRET` (fail closed if unset) | **closed** |
| T-CB-08 | Tampering | Email HTML (`notifications.ts`) | mitigate | `esc()` on all user-controlled HTML interpolations | **closed** |
| T-CB-09 | Information disclosure | `get_subordinates` RPC | mitigate | Caller auth check (00025); no arbitrary manager_uuid reads | **closed** |
| T-CB-10 | Information disclosure | `compute_annual_averages` RPC | mitigate | Role-aware caller check (employee = self only) | **closed** |
| T-CB-11 | Tampering | OpenAI historical extract | mitigate | Zod (or equivalent) validate model JSON before use | **closed** |
| T-CB-12 | Information disclosure / Abuse | `extractReviewWithLLM` | mitigate | Authenticate caller; restrict to manager/HR on report | **closed** |
| T-CB-13 | Elevation | Netlify service role | mitigate | Cron-only invocation; minimal queries; EMPLOYEE-only reminders | **closed** |
| T-CB-14 | Tampering | HR guide markdown render | mitigate | `marked` + `sanitize-html` before `dangerouslySetInnerHTML` | **closed** |

*Disposition: **mitigate** unless noted in Accepted Risks Log.*

---

## Threat Verification (2026-06-04)

| Threat ID | Status | Evidence |
|-----------|--------|----------|
| T-CB-01 | **closed** | Fixed: `safeRedirectPath()` validates `next` starts with `/`, blocks `//` and `://`. Commit `b2661d0`. |
| T-CB-02 | **open** | TS: `src/lib/auth/allowed-domains.ts:3-9` includes `clovrlabs.com`. SQL: `supabase/migrations/00018_domain_whitelist.sql:15-17` omits `clovrlabs.com`. |
| T-CB-03 | **closed** | Fixed: `isAllowedEmail()` guard added before fallback insert in `server.ts`. Commit `9d406bc`. |
| T-CB-04 | **closed** | Fixed: RPC error now triggers `signOut()` + redirect to `/login?error=provision`. Commit `bb667c4`. |
| T-CB-05 | **open** | No `src/middleware.ts` (glob 0). `src/proxy.ts:18` exports `proxy`, not `middleware`. First-check-in gate only in dead `src/proxy.ts:64-91`. Partial substitute: `src/app/(protected)/layout.tsx:16-17` (`getUser` redirect) — does not enforce first-check-in. |
| T-CB-06 | **closed** | `supabase/migrations/00025_security_fixes.sql:8-14` — `WITH CHECK (... AND role = (SELECT role FROM profiles WHERE id = auth.uid()))`. |
| T-CB-07 | **closed** | Fixed: Both handlers return 403 when `REMINDER_SECRET` is not set. Commit `1ecfbc9`. |
| T-CB-08 | **closed** | Fixed: `esc()` applied to all greetings and subjects across all notification functions. Commit `599c185`. |
| T-CB-09 | **closed** | Fixed: `00032_restore_get_subordinates_caller_check.sql` restores `auth.uid()` guard with 00030 return type + `is_active` filter. Commit `536ddc4`. |
| T-CB-10 | **closed** | `supabase/migrations/00025_security_fixes.sql:72-84` — role check + employee self-only. No later migration replaces `compute_annual_averages`. |
| T-CB-11 | **closed** | Fixed: `extractedReviewSchema.safeParse()` replaces unsafe cast. Scores constrained 1–5. Commit `cabafa3`. |
| T-CB-12 | **closed** | Fixed: `getUser()` auth check added at top of `extractReviewWithLLM`. Commit `8b2b11a`. |
| T-CB-13 | **closed** | Service role scoped in code: `slack-reminders.mts:64-70`, `email-reminders.mts:64-69` — `.eq('role', 'EMPLOYEE')`; idempotency via `reminder_log` (`:160-175`, `:162-177`). Platform cron in `netlify.toml` (documented in INTEGRATIONS.md). |
| T-CB-14 | **closed** | `src/app/(protected)/guide/page.tsx:12-18` — `sanitizeHtml` with restricted tags/schemes before `:139` `dangerouslySetInnerHTML`. |

---

## Unregistered Flags

| Flag | Source | Notes |
|------|--------|-------|
| Data-integrity silent success (CR-05–CR-09, CR-11–CR-15) | `.planning/REVIEW.md` | Out of STRIDE scope for this audit; several update paths now check `{ error }` (e.g. `checkin-actions.ts:134-135`, `performance-actions.ts:131-132`). Not mapped to threat IDs. |
| `historical_reviews` table / RLS | Implementation | `saveHistoricalReview` inserts with caller `manager_id` but no in-repo migration grep match; authorization beyond auth.uid() not verified here. |
| ARCHITECTURE claims `proxy.ts` replaces `middleware.ts` | `.planning/codebase/ARCHITECTURE.md:91` | Contradicts repo reality (no runnable middleware); doc drift only. |

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-04 | 14 | 4 | 10 | gsd-security-auditor (retroactive STRIDE) |
| 2026-06-04 | 14 | 9 | 5 | gsd-audit-fix (F-01–F-05 auto-fixed) |
| 2026-06-04 | 14 | 12 | 2 | gsd-audit-fix (F-06–F-08 auto-fixed) |

---

## Remediation Priority (open threats)

1. **T-CB-02** — Align SQL domain whitelist with TS (`clovrlabs.com` missing in SQL). Design decision: single source of truth.
2. **T-CB-05** — Add `src/middleware.ts` exporting `middleware` (re-export from `proxy` or rename). Architectural change.

---

## Sign-Off

- [x] All threats have a disposition (mitigate)
- [ ] Accepted risks documented (none accepted)
- [ ] `threats_open: 0` confirmed
- [ ] `status: verified` set in frontmatter

**Approval:** pending — 10 open threats
