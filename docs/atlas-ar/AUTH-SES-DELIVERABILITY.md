# AUTH-SES — Cognito verification email deliverability

**Status:** **IN PROGRESS** (ops) — app still uses Cognito `signUp()`; spam is from **default Cognito email**, not Atlas SMTP.  
**Goal:** Signup / forgot-password codes land in **inbox**, not spam.  
**Region:** `ap-south-1` (same as Cognito pool).  
**Domain:** `atlasar.in`  
**FROM:** `noreply@atlasar.in` · display name **Atlas AR**  
**Pool:** confirm `VITE_COGNITO_USER_POOL_ID` in Amplify (historically `ap-south-1_pZ89OQZpV`).

**Related:** [AMPLIFY-ENV-CHECKLIST.md](./AMPLIFY-ENV-CHECKLIST.md) · contact SoT `src/shared/contact.ts` (`support@` / `sales@`).

---

## Until SES production access is approved

**Keep Cognito Messaging on “Send email with Cognito”** (previous setting). Do **not** switch the pool to SES while the SES account is still in **sandbox** — unverified Gmail recipients will not receive mail reliably.

App recovery (shipped): Verify email screen → **Resend verification code** (`CognitoUser.resendConfirmationCode`) with a 60s cooldown. That uses the **current** Cognito email provider (default Cognito or SES once you flip it later).

---

## Why codes go to spam

Cognito’s **built-in** email uses a shared Amazon sender. Gmail/Outlook often classify that as bulk/untrusted.  
**Fix (after SES production + domain verified):** SES domain identity + Cognito Messaging → “Send email with Amazon SES” + SPF/DKIM/DMARC on `atlasar.in`.

UI copy already tells users to check spam; Resend is the product recovery path while deliverability is improved.

---

## Founder checklist (AWS Console + DNS)

### 1. SES — verify domain

1. AWS Console → **Amazon SES** → region **ap-south-1**.  
2. **Identities** → **Create identity** → **Domain** → `atlasar.in`.  
3. Enable **Easy DKIM** (RSA_2048_BIT).  
4. Copy the **3 CNAME** records into DNS for `atlasar.in` (wherever the domain is hosted).  
5. Wait until identity status is **Verified** (often 15–60 minutes; can be longer).

### 2. SES — leave sandbox (if still sandboxed)

1. SES → **Account dashboard** → Request **production access** (or “Get set up” / move out of sandbox).  
2. Use case: transactional account verification + password reset; low volume; recipients are signup users.  
3. Wait for approval before relying on mail to arbitrary Gmail addresses.

### 3. Cognito — use SES

1. **Cognito** → User pools → pool matching Amplify `VITE_COGNITO_USER_POOL_ID`.  
2. **Authentication** → **Messaging** (or **Messaging** / Email) → **Edit**.  
3. Email provider: **Send email with Amazon SES**.  
4. FROM email address: **`noreply@atlasar.in`** (must be on the verified domain; can be a mailbox you do not read).  
5. FROM display name: **`Atlas AR`**.  
6. SES region: **ap-south-1**.  
7. Save — allow Console to create the **Cognito → SES** IAM role if prompted.  
8. Confirm configuration shows SES / `noreply@atlasar.in`, **not** “Send email with Cognito”.

### 4. DNS — SPF + DMARC

On `atlasar.in` DNS (merge with any existing SPF; only **one** SPF TXT at apex):

| Type | Name | Value |
|------|------|--------|
| TXT | `@` (apex) | `v=spf1 include:amazonses.com ~all` — **or** append `include:amazonses.com` to the existing SPF |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:support@atlasar.in` |

DKIM CNAMEs from step 1 must remain. Tighten DMARC (`p=quarantine` / `p=reject`) only after inbox tests stay green for a week.

### 5. Optional — verification template

Cognito → Messaging → Message templates:

- Subject: `Your Atlas AR verification code`  
- Body: short, branded, include `{####}` code; avoid ALL CAPS / “urgent” / many links.

### 6. Test (PASS criteria)

1. Sign up a **new** unused Gmail (or Outlook) address on `https://www.atlasar.in` (or Amplify `main`).  
2. Code arrives in **Primary/Inbox** within a few minutes (not only Spam).  
3. Open message → **Show original** / View source:  
   - **SPF:** PASS  
   - **DKIM:** PASS  
   - **DMARC:** PASS (or at least aligned once DMARC is live)  
4. FROM shows **Atlas AR \<noreply@atlasar.in\>** (not an `@amazonses.com` / Cognito default style sender).  
5. Optional: forgot-password flow also inbox.

Mark this doc **PASS** and memory when the above holds.

---

## What is not required

- No Amplify env var for SES.  
- No change to `signUp()` / frontend mailer.  
- No Custom Email Sender Lambda for v1.  
- Amplify push only if you commit this runbook.

---

## Rollback

Cognito Messaging → revert to **Send email with Cognito** (spam will return). Keep SES identity for later.

---

## Changelog

| Date | Note |
|------|------|
| 2026-08-01 | Runbook created from prior chat recommendation; domain `atlasar.in` now available. |
