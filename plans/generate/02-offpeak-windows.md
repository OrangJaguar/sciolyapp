# Plan 02 — Off-peak run windows (DeepSeek calendar)

**Track:** `plans/generate`  
**Depends on:** Plan 01 (deployed)  
**Touches:** `_shared/generation.ts` (`isInsideRunWindow`), job `config.window`, GeneratePage window controls, cost estimate

## Goal

Generation **only burns DeepSeek tokens in off-peak** unless an admin explicitly allows peak. Match DeepSeek’s published peak windows, not a vague “Chicago business hours” default.

## Amendments after Plan 01

- Provider `auto` resolves server-side; window check should use **resolved** DeepSeek vs NIM (if config says `auto` and DeepSeek key exists → apply DeepSeek calendar when mode is off-peak).
- Share calendar helpers conceptually on client (`src/lib/generationWindow.ts`) for live Now: PEAK/OFF-PEAK indicator.
- Selecting DeepSeek Flash/Pro in Admin turns **Respect off-peak** on by default.

## DeepSeek schedule (as of Aug 2026 pricing)

**Peak (Mon–Fri UTC only):**

- `01:00–04:00` UTC  
- `06:00–10:00` UTC  

**Off-peak:** all other times (weekends + weekday gaps). Off-peak ≈ **½** peak price.

## Work items

### A. Window modes in job config

```ts
type GenerationWindowConfig = {
  enabled: boolean
  mode: 'deepseek_offpeak' | 'custom'
  tz?: string
  start?: string
  end?: string
  allowPeak?: boolean
}
```

DeepSeek defaults: `enabled: true`, `mode: 'deepseek_offpeak'`, `allowPeak: false`.

### B. Server `isInsideRunWindow(config)`

Respect mode + allowPeak + provider hint in config.

### C. Admin UI

Respect off-peak toggle, DeepSeek preset, allow peak, custom fields, live indicator, jobs list label.

### D. Cost estimate

Off-peak by default; show peak estimate when allowPeak.

## Acceptance

- [x] Peak UTC weekday → `outsideWindow`
- [x] Off-peak → processes
- [x] `allowPeak` overrides
- [x] Custom window for NIM
- [x] Build passes

## Shipped

- Server `isInsideRunWindow` DeepSeek UTC peak calendar + `allowPeak` / `mode`
- `src/lib/generationWindow.ts` client mirror + live rate label
- Admin Generate: respect window, DeepSeek off-peak preset, allow peak, custom TZ, cost peak/off-peak
- Jobs list / active job show window summary vs paused-by-admin

## Apply

```bash
supabase functions deploy generate-worker
```
