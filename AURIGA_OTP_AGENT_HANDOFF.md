# Auriga — OTP / Verify Email Screen
## Agent-ready design + implementation handoff

**Source of truth for:** the email verification checkpoint in the Auriga invite/auth flow.  
**Reference:** HeroUI Native Beta 12 release — `InputOTP`, `Label`, `Description` — and the InputOTP component docs.  
**Important:** borrow HeroUI’s **rhythm, clarity and OTP behavior**, not its documentation shell, gray palette, bright interface blue, Inter typography, glass slots, or SaaS card styling.

---

## 0. Scope

Build **one quiet checkpoint**: a person arrives from an invite or sign-up, is told a six-digit code was sent to their email, enters it, and continues into Auriga.

This document defines:

- the OTP screen itself;
- the shared portfolio shell it sits inside (nav, 12/8/4-column grid, paper surface, type, rules);
- every state, interaction, accessibility requirement and acceptance criterion.

It does **not** redefine the existing portfolio or the shade-matching workspace. Keep their layout, navigation, section order, imagery, content and core identity intact.

The OTP screen is a deliberate pause inside the product — not a separate SaaS login template, not a marketing page, and not a component demo.

---

## 1. Design direction

### One sentence

A colour-lab verification slip: warm paper, precise type, a thin grid, and six OTP slots as the only visual event.

### Adjectives

calm · precise · human · editorial · instrument-like · spacious · quietly technical

### Borrow from HeroUI Beta 12

- **Alternating compression and release:** tight heading cluster → 24px pause → functional block → 24px pause → action → 12px utility → generous surrounding quiet.
- **One job per screen.** No competing panels, promos or sidebars.
- **Real component behavior:** grouped slots, separator, paste transformation, validation, controlled value, accessible label/description.
- **Measured hierarchy:** 28–32px title, 14–16px description, 16px body, 11–12px cues.

### Do not borrow

- HeroUI’s gray documentation background or bright interface blue.
- The three-column docs shell, release sidebar, “On this page” rail, search bar.
- Code-card chrome, pill controls, promo overlays, component-demo framing.
- Inter.
- Glassmorphism, `SlotBackground` glass, gradients, glow, heavy shadows.
- Rounded SaaS cards, oversized authentication cards, illustration blobs.
- Maroon as a decorative accent. Error color may be a muted functional red; never a surface.

### Keep from the portfolio

- Warm cream-paper canvas.
- Black ink and deep-blue accent.
- Neue Haas Grotesk, with Suisse Int’l / Helvetica Neue fallbacks.
- Thin rules, lowercase labels, small technical annotations.
- Controlled asymmetry and slight human imperfection.
- Existing nav shell and page grid.
- Restrained motion: 140–220ms, 3–6px directional movement.
- One construction marker at most. The OTP slots are the event.

---

## 2. Screen anatomy

```
┌────────────────────────────────────────────────────────────────────┐
│  auriga                                      back to match   privacy │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  01 / verify                                                         │
│                                                                      │
│  Verify your email                                                   │
│  We sent a six-digit code to a••••@umn.edu.                          │
│                                                                      │
│  [ 0 ] [ 0 ] [ 0 ]   —   [ 0 ] [ 0 ] [ 0 ]                          │
│  This code expires in 09:41.                                         │
│                                                                      │
│  [ Verify ]                                                          │
│                                                                      │
│  Resend in 00:42                              Use a different email   │
│                                                                      │
│  We use this code only to confirm it’s you.                          │
│                                                                      │
└────────────────────────────────────────────────────────────────────┘
```

The form is **not** wrapped in a card. It sits directly on the paper. One hairline rule may separate the action row from the utility row, or the utility row from the privacy note. Not both unless the composition needs it.

---

## 3. Layout and grid

Use the existing portfolio grid. Do not invent a second system.

```css
.page {
  width: min(100%, 1600px);
  margin-inline: auto;
  padding-inline: clamp(16px, 3vw, 48px);
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  column-gap: clamp(12px, 1.6vw, 24px);
}
```

### Desktop (≥ 1200px)

- **Nav:** full width, 64–72px high, 1px bottom rule.
- **Left cue:** columns 1–2. Small `01 / verify` label, top-aligned with the title. Optional one short vertical rule.
- **Form:** columns 4–7. `max-width: 460px`. Left-aligned. No card.
- **Right note:** columns 10–12, top-aligned with the first OTP slot. One short privacy/expiry note. No card, no border box.
- **Vertical rhythm:** 72–96px from nav to the `01 / verify` cue; 8px cue → title; 8px title → description; 24px description → OTP slots; 10–12px slots → expiry/error; 24px status → Verify; 12px Verify → utility row; 40–56px utility → privacy note.

The form must not be mechanically centered in the viewport. The grid offsets it. The empty left and right space is part of the composition.

### Tablet (768–1199px)

- 8-column grid.
- Form columns 2–6, `max-width: 460px`.
- Right note columns 7–8, or moves below the utility row.
- Nav remains 64–72px.

### Mobile (< 768px)

- 4-column grid.
- 16–20px outer gutters.
- Form full width; no side cue or right note.
- Stack: nav → `01 / verify` → title → description → OTP slots → status → Verify → utility row → privacy note.
- Six slots stay on one row. Do not wrap them into 3×2.
- Keep Verify reachable without scrolling on a 390×844 device where possible.
- Do not autofocus the OTP on mount (avoid opening the keyboard and shifting the layout). Let the person tap.

---

## 4. Exact measurements

| Element | Desktop | Mobile |
| --- | --- | --- |
| Form column | 400–460px | 100% |
| Title | 30px / 600 / 1.1 | 26px / 600 / 1.12 |
| Description | 15px / 400 / 1.55 | 14px / 400 / 1.55 |
| Small cue | 11px / 600 / tracked .12em | 10px |
| OTP slot | 48×56px | 44×54px (min 40×50 at ≤360px) |
| Slot gap | 6–8px | 5–6px |
| Group separator | 12–16px | 12px |
| OTP digit | 24px / 500 / tabular | 22px |
| Expiry / error line | 12px | 11–12px |
| Primary button | 48px high, 6px radius | 46–48px |
| Utility text | 13px | 12–13px |
| Major block spacing | 24px | 20–24px |
| Form to nav | 72–112px | 40–56px |
| Privacy note | 40–56px below utility | 32–40px |

Slot group width at desktop:

```text
3 × 48 + 2 × 6 + 14 + 3 × 48 + 2 × 6 = 326px
```

That fits the 400–460px form with quiet space on the right. Do not stretch the slots to fill the form.

---

## 5. Visual system

Use the live portfolio/Auriga tokens. If a token already exists, keep it. The values below are the reference set from the white-grid handoff.

```css
:root {
  --paper: #fbfbf8;
  --paper-pure: #ffffff;
  --paper-subtle: #f4f4ef;
  --paper-raised: #fdfdfb;

  --ink: #171715;
  --ink-soft: #42423e;
  --ink-muted: #74746e;
  --ink-faint: #9a9a92;

  --line: #e3e3dc;
  --line-strong: #c9c9c1;
  --line-dark: #8d8d84;

  --blue: #1f4e79;
  --blue-active: #173f66;
  --blue-wash: #edf2f6;

  --success: #35634a;
  --warning: #8a6420;
  --danger: #8a3e39; /* error text/rules only; never a decorative surface */

  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
}
```

### Rules

- Canvas: `--paper`.
- The OTP slot surface: `--paper-pure` or `--paper-raised`.
- OTP slot border: 1px `--line-strong`; filled border remains quiet; active slot uses `--blue` and a 2px caret.
- Primary button: `--ink` fill, `--paper` text. No blue fill.
- Links, focus, active nav underline, caret: `--blue`.
- Error: `--danger` text + a 1px `--danger` slot border. Never a red-filled card.
- Success: `--success` text/check. No green surface.
- No maroon, no gradients, no glow, no glass, no heavy shadow.
- Use borders and spacing before shadow. Shadow only if a floating menu exists; the OTP page has none.

### Typography

```css
font-family: "Neue Haas Grotesk", "Suisse Int'l", "Helvetica Neue", Arial, sans-serif;
```

- Use tabular figures for OTP digits and the countdown.
- Use a monospaced face only for the countdown, masked email, and tiny technical annotations if needed.
- Sentence case for titles and messages.
- Lowercase for nav links, the `01 / verify` cue, and utility labels.
- Reading width: 48–68 characters; the form is narrower by design.
- Do not use Inter.

### Nav

Preserve the portfolio nav height, paper background, 1px bottom rule and alignment.

For this checkpoint, keep it reduced:

```text
auriga                                      back to match   privacy
```

- Product mark aligned to the first grid column.
- Right side: `back to match` and `privacy` as quiet text links.
- No active underline unless the route is part of a visible multi-step flow. If there is a step indicator, use one 2px blue underline or a small `01 / 02`.
- No pricing, sign-in, dashboard, search, notification or profile controls.
- Mobile: product mark + one text menu trigger; preserve the same paper sheet and focus behavior.
- Do not add a second auth-specific nav.

If the existing nav must remain unchanged, keep its links and active-state rules but do **not** highlight a marketing section as active on this checkpoint. The form is the active thing.

---

## 6. OTP component behavior

### Structure

- Six digits, grouped **3 + 3**, separated by a 12–16px gap or a 1px vertical rule 16px tall. Prefer the rule; it reads as a measuring instrument, not a pill group.
- Each slot is a single character. Empty slots show a quiet placeholder (a thin dot or dash, not a `0`).
- One active caret in the current slot. The caret is a 2px blue vertical stroke, 16–18px tall, blinking at ~1s; stop blinking under reduced motion.
- The slots are the visual event. Do not add a colored container behind them.

### If using HeroUI Native Beta 12

```tsx
<InputOTP
  ref={ref}
  maxLength={6}
  value={value}
  onChange={setValue}
  onComplete={handleComplete}
  isInvalid={hasError}
  inputMode="numeric"
  pattern={REGEXP_ONLY_DIGITS}
  pasteTransformer={(text) => text.replace(/\D/g, "").slice(0, 6)}
  textInputProps={{
    textContentType: "oneTimeCode",
    autoComplete: "one-time-code",
  }}
>
  <InputOTP.Group>
    <InputOTP.Slot index={0} background={null} />
    <InputOTP.Slot index={1} background={null} />
    <InputOTP.Slot index={2} background={null} />
  </InputOTP.Group>
  <InputOTP.Separator />
  <InputOTP.Group>
    <InputOTP.Slot index={3} background={null} />
    <InputOTP.Slot index={4} background={null} />
    <InputOTP.Slot index={5} background={null} />
  </InputOTP.Group>
</InputOTP>
```

- Use `Label` and `Description` for the accessible label/description. If the title is a custom heading, connect it with `aria-labelledby` / `accessibilityLabelledBy`.
- Set `background={null}` on each slot; do not inherit the glass/default theme background.
- Prefer `animation="disable-all"` on the root and add a restrained 140–160ms fade/2px rise; or set `InputOTP.SlotValue animation={false}` and animate the slot wrapper yourself. Do not use the default 3D flip. If you keep the default animation, reduce it to a 150ms opacity + 2px translate.
- Use `isInvalid` for the error border; keep the error message outside the slots.
- Use `onComplete` only to enable/focus Verify, not to auto-submit. The person presses Verify.
- Use `ref.current?.clear()` on resend and on a fresh code, then focus the first slot.
- If rendered inside a BottomSheet, wire `useBottomSheetAwareHandlers`; this screen should be a page, not a sheet.

### If implementing on web

- Prefer one visually hidden `<input>` (`maxLength=6`, `inputMode="numeric"`, `pattern="[0-9]*"`, `autoComplete="one-time-code"`) that owns focus, paste and autofill. Render six visual slots from its value.
- If using six inputs, each needs a label (`Digit 1 of 6`), arrow-key navigation, backspace behavior, and a paste handler that distributes digits. One hidden input is simpler and more reliable for OTP autofill.
- `aria-describedby` points to the description, expiry and error.
- Keep the focus ring on the input/group, not six competing rings.

### Input rules

- Digits `0–9` only.
- Paste strips spaces, hyphens and non-digits.
- If six digits are pasted, fill all six and focus Verify; do not submit.
- If fewer than six, fill from the current slot and focus the next empty.
- Backspace clears the current slot, then moves left.
- Arrow keys move between slots.
- Do not accept letters or a seventh digit.
- On complete, do not clear the code. Keep it visible while verifying.
- On invalid, keep the code so the person can correct one digit. Select the group / focus the first empty.
- On expired, keep the screen but replace the status line with the expiry message and make **Send a new code** the obvious action.

### Verify button

- Always enabled; on press validate six digits. Do not use a disabled low-contrast button.
- If incomplete: focus the first empty slot and show `Enter all six digits.` under the slots. Do not show a toast.
- If verifying: button label `Verifying…`; slots read-only; a restrained three-square progress motif; no spinner theatre.
- On success: show the success state for 600–900ms, then continue. Provide a `Continue` action if the redirect is delayed.
- On failure: keep the code, mark invalid, show one sentence, return focus to the group.

### Resend

- Initial: `Resend in 00:42` with a real countdown (mono, tabular). The text action is disabled until zero.
- At zero: `Send a new code` link. On press, clear the code, reset the countdown, announce `New code sent.`, focus the first slot.
- Do not announce every second to screen readers. Announce only when resend becomes available and when a new code is sent.

### Change email

- `Use a different email` returns to the email step. Preserve the typed email in context; do not clear the rest of the flow.
- This is a text action, not a button. It sits opposite the resend control on desktop; below it with 12px gap on mobile.

---

## 7. States

| State | Screen | Copy / behavior | Design intent |
| --- | --- | --- | --- |
| Default | Empty six slots, expiry line, Verify | `Verify your email` / `We sent a six-digit code to a••••@umn.edu.` | Invite, don’t demand |
| Focus | Active slot with blue caret; group focus ring | — | One clear place to type |
| Partial | Some digits filled | Expiry line stays; no error yet | Quiet progress |
| Complete | Six digits; Verify active | Optional `Press Verify to continue.` | Clear next step |
| Verifying | Slots read-only; button `Verifying…`; three squares | Keep code visible | No fake spinner |
| Incorrect | Slots keep values; 1px danger border; error under slots | `That code didn’t match. Check the six digits and try again.` | Correctable, not scolding |
| Expired | Code may remain; danger/quiet message; resend emphasized | `That code expired. Send a new one.` | One recovery path |
| Resend cooldown | Text action disabled; countdown | `Resend in 00:42` | Calm waiting |
| Resend available | `Send a new code` link | `New code sent.` live announcement | Obvious recovery |
| Rate limited | Message under slots; Verify remains | `Too many attempts. Wait a minute or send a new code.` | No dead end |
| Network error | Keep code; message | `We couldn’t verify that just now. Try again.` | Retry is clear |
| Success | Form replaced or collapsed; check + short line | `Email verified. Taking you to your colour match…` | Quiet payoff |
| Reduced motion | No caret blink, no digit movement | All states still legible | Calm by default |
| Mobile keyboard | Form scrolls above keyboard; Verify reachable | No autofocus on mount | One-handed use |

### Success state

- Replace the title with `Email verified`.
- One line: `Taking you to your colour match…`
- A small `Continue` text action appears if the transition takes longer than ~900ms.
- No confetti, no score count, no bounce.
- If the product immediately redirects, the success state may be a 600–900ms inline confirmation on the same paper surface.

---

## 8. Copy deck

### Default

- Cue: `01 / verify`
- Title: `Verify your email`
- Description: `We sent a six-digit code to a••••@umn.edu.`
- Button: `Verify`
- Resend: `Resend in 00:42` → `Send a new code`
- Change email: `Use a different email`
- Expiry: `This code expires in 09:41.`
- Privacy: `We use this code only to confirm it’s you.`

### Validation

- Incomplete: `Enter all six digits.`
- Incorrect: `That code didn’t match. Check the six digits and try again.`
- Expired: `That code expired. Send a new one.`
- Rate limited: `Too many attempts. Wait a minute or send a new code.`
- Network: `We couldn’t verify that just now. Try again.`
- Resent: `New code sent.`

### Success

- Title: `Email verified`
- Body: `Taking you to your colour match…`
- Action: `Continue`

### Tone rules

- One sentence per problem.
- One next action per problem.
- Never expose status codes, stack traces, provider names or browser API jargon.
- Never say “invalid user,” “failed,” “bad code,” or “error 401.”
- Never imply the person is being analysed. This screen verifies an email, nothing else.

---

## 9. Motion

Borrow the **rhythm**, not literal bounce.

| Event | Motion |
| --- | --- |
| Page/form entrance | 180ms opacity + 6px rise; optional, once |
| Slot focus | 140ms border/caret color |
| Digit entry | 140–160ms opacity + 2px rise; no 3D flip |
| Digit delete | 100ms opacity |
| Verify press | 140ms button press; no scale bounce |
| Verifying | three 4px squares, 15% → 100% opacity, 120ms stagger, loop only while real work runs |
| Error | 140ms border-color; no shake |
| Success | 180ms crossfade; no confetti |
| Resend | 140ms text-color; no toast |

- Use exponential ease-out. No spring, elastic, orbit, or floating.
- Under `prefers-reduced-motion: reduce`: no caret blink, no digit rise, instant/opacity-only state changes. Keep the three-square progress static but readable.
- Do not animate every value at once. Change the slot first, then the status line.

---

## 10. Accessibility

- One accessible OTP control, not six unrelated text fields if avoidable.
- Visible title connected with `aria-labelledby`; description, expiry and error with `aria-describedby`.
- `aria-invalid` when incorrect/expired.
- `aria-live="polite"` for meaningful status changes only: code sent, verifying, expired, verified, resend available. Do not announce each digit.
- Keyboard: Tab into the group; type digits; Backspace; arrows; paste; Enter submits; Escape is not needed.
- Focus after error: return to the OTP group and announce the message once.
- Focus ring: 2px `--blue`, 2px offset; visible on paper and on every slot state.
- Touch targets ≥ 44×44px. The 48×56 slot satisfies this; mobile 44×54 does too.
- Contrast: AA for all text; digits 24px at ink on paper; error text `--danger` on paper; never color alone (use the message text).
- 200% zoom: no horizontal page scroll; six slots may scale down but must remain one row.
- Screen reader label example: `Six-digit verification code. We sent a code to a••••@umn.edu.`
- Do not describe the person or infer identity. The only claim is the email confirmation.
- Respect reduced motion.
- If the code is pasted from another app, announce `Code pasted` only if it fills all six; otherwise announce nothing.

---

## 11. Privacy and trust

Keep it small and true.

- `We use this code only to confirm it’s you.`
- `It expires in 10 minutes.`
- No marketing consent, no pre-checked boxes, no “create your profile” pressure.
- If the OTP is for an invite, say `This invite is for a••••@umn.edu.` only if the backend confirms the invite.
- If the product later analyzes a face photo, do not conflate the two consents. The OTP screen verifies email; the shade screen has its own privacy note.
- If any data leaves the device, state what, why and for how long before the code is requested. Do not bury it.

---

## 12. Implementation notes

### Keep separate

- capture/auth step state;
- email address;
- OTP value;
- verification status (`idle | verifying | success | error`);
- error kind (`incomplete | incorrect | expired | rate-limited | network`);
- resend cooldown;
- focus/slot index.

### Suggested component tree

```text
VerifyEmailScreen
├── TopNav (existing shell, reduced links)
├── Grid
│   ├── StepCue ("01 / verify")
│   ├── FormColumn
│   │   ├── Title (h1)
│   │   ├── Description (masked email)
│   │   ├── OTPGroup (InputOTP or hidden input + slots)
│   │   ├── StatusLine (expiry / error, one at a time)
│   │   ├── VerifyButton
│   │   ├── UtilityRow (resend / change email)
│   │   └── PrivacyNote
│   └── MarginNote (expiry/privacy, desktop only)
└── LiveRegion (polite)
```

### Rules

- The OTP group must never collapse while waiting; always render six slots.
- The Verify button stays enabled.
- Resend clears the code and resets focus; change-email preserves the email.
- On success, do not leave the OTP input active under the success message.
- Do not use a modal/dialog for this page unless the product flow is already a modal. A checkpoint should be a page.
- Do not add a “Remember me,” password, social login, or marketing checkbox to this screen.
- Do not show a face or shade-matching UI here. This is the email checkpoint.

---

## 13. Acceptance criteria

The screen is done when:

- [ ] It reads as a quiet checkpoint inside the existing portfolio, not a SaaS login template.
- [ ] The nav, 12/8/4 grid, paper surface, Neue Haas type and thin rules match the existing shell.
- [ ] No HeroUI gray palette, bright blue, Inter, docs shell, search, code cards, glass or pill chrome remain.
- [ ] The form is 400–460px on desktop, left-aligned in columns 4–7, with the `01 / verify` cue and one margin note.
- [ ] Six slots, 3 + 3, 48×56 desktop / 44×54 mobile, 6–8px gap, 12–16px separator, one row on mobile.
- [ ] The six slots are the strongest visual element; no card surrounds them.
- [ ] The title is 28–32px, description 14–16px, button 48px, utility 13px.
- [ ] The code accepts digits only, pastes cleanly, autofills as a one-time code, and supports arrow/backspace navigation.
- [ ] Verify is enabled, validates six digits, shows one error sentence, keeps the code, and returns focus.
- [ ] Verifying, incorrect, expired, rate-limited, network, resend and success states all exist.
- [ ] Resend counts down in real time and announces only when available.
- [ ] Error is never communicated by color alone; focus is visible; targets are ≥44px.
- [ ] The screen works at 200% zoom and with reduced motion.
- [ ] No maroon decorative surface, no gradients, no glow, no glass, no oversized auth card.
- [ ] The existing portfolio layout, nav, content, imagery and shade-matching page are unchanged.
- [ ] The success state does not use confetti, bounce or score counting.

---

## 14. One-shot prompt for the agent

```text
Design and implement the Auriga email-verification OTP screen as a quiet checkpoint inside the existing portfolio shell.

Read AURIGA_OTP_AGENT_HANDOFF.md as the source of truth. Also read the HeroUI Native Beta 12 InputOTP docs for behavior, but do not copy HeroUI’s visual shell.

Borrow HeroUI Beta 12’s rhythm and clarity: tight heading cluster, 24px functional gaps, one job per screen, grouped InputOTP slots, Label/Description, paste transformation, validation and accessible states. Do not borrow its gray docs palette, bright blue, Inter, three-column documentation shell, search bar, code cards, pill controls or glass slot background.

Preserve the existing portfolio: warm cream paper, black ink, deep blue accent, Neue Haas Grotesk, thin rules, lowercase labels, controlled asymmetry, existing nav and 12/8/4 grid. No maroon, no gradients, no glow, no glass, no oversized auth card, no SaaS login template.

Build a 400–460px left-aligned form in desktop columns 4–7, with a small “01 / verify” cue in columns 1–2 and one quiet margin note in columns 10–12. The form contains: title “Verify your email” (28–32px); description “We sent a six-digit code to a••••@umn.edu.” (14–16px); six OTP slots grouped 3 + 3 (48×56 desktop, 44×54 mobile, 6–8px gaps, 12–16px separator); one expiry or error line; Verify button; resend countdown and “Use a different email”; one privacy note. No card around the form. The slots are the visual event.

Implement every state: default, focus, partial, verifying, incorrect, expired, rate-limited, network error, resend cooldown/available, success, reduced motion, mobile keyboard. Keep the code visible while verifying and after an incorrect attempt. Verify stays enabled and validates on press. Resend clears the code and resets focus. Success is a calm inline confirmation, not confetti.

Use HeroUI Native InputOTP if the target is React Native: maxLength=6, REGEXP_ONLY_DIGITS, pasteTransformer stripping non-digits, textContentType/autoComplete one-time-code, isInvalid, background={null} on slots, restrained 140–160ms motion instead of the default 3D flip. If the target is web, use one hidden input with six visual slots, inputMode=numeric, autoComplete=one-time-code, paste distribution, arrow/backspace support and aria-describedby.

Meet WCAG AA, 44px touch targets, 2px blue focus rings, polite live announcements for meaningful status only, 200% zoom, and reduced motion.

Do not change the existing portfolio layout, navigation, section order, imagery, content, or the shade-matching page. This document is only the OTP checkpoint and the shared shell.

Verify every acceptance criterion before finishing.
```
