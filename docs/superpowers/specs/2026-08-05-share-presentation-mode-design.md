# Design: Dashboard Presentation Mode + Public Share

Date: 2026-08-05
Status: Approved
Feature area: Dashboard sharing & presentation (all dashboards)

## 1. Overview

Add to every dashboard (analyst, OCS, OS, OP, HT — the tab-bar dashboards) a **Share** and a **Presentation (kiosk)** feature, modeled on Google Looker Studio publishing:

- **Public share link** — owner publishes a tab (or the whole dashboard) with an explicit data scope (date range + hub/station/airline/category filters). Public viewer opens a clean, read-only view: no app navigation, no filters, no drilldown, no export, no raw data tables. Tooltips and internal sub-view toggles still work.
- **Presentation (kiosk) mode** — in-app fullscreen overlay of the same read-only render, for projecting. Tab bar visible so the presenter can switch tabs; Esc / close button exits.
- **Link management** — copy link, QR code, update scope, revoke. Revoked links 404.

Share audience: internal stakeholders without logins (link-only access, no passcode — approved).

## 2. Context (verified findings)

- **Auth:** custom JWT session (`session` cookie, `JWT_SECRET`) enforced in `proxy.ts` middleware. Public whitelist already covers `/embed/*`, GET `/api/dashboards`, `/api/reports/public`, `/api/joumpa/public`, `/api/master-data`.
- **Existing public dashboard machinery:** `custom_dashboards` table (slug + `is_public`) rendered publicly at `/app/embed/custom/[slug]/page.tsx`; `getPublicDashboardPageData` serves its data. Reuse the pattern, not the table (this feature covers the live analyst tab bar, not builder dashboards).
- **Tab bar:** `components/dashboard/analyst/AnalystCharts.tsx:121-133` — tabs `summary`, `sqi`, `joumpa`, `gse`, `cgo_cargo`, `delay`, `status_details` (labels: Summary Report, Landside & Airside Detail Report, Joumpa Service, GSE Performance Detail Report, CGO Cargo Report, Delay Code Report, Reports Status Details). `OPAnalystCharts.tsx` is the OP variant; `AnalyticsDashboard.tsx` the OCS one.
- **Render chain:** `DivisionAnalystDashboard.tsx` → `ChartSection` (`components/dashboard/analyst/ChartSection.tsx`) → `AnalystCharts`/`OPAnalystCharts`; OCS/OS dashboards also use `ChartSection` or `AnalyticsDashboard`. All chart datasets (caseCategory, branch, monthly, area, comparison, …) are computed **client-side in `ChartSection` via `useMemo`** from the reports array.
- **Session-free data paths (verified):** `reportsService.getReports({ source: 'sync' })` (`lib/services/reports-service.ts:2211`) and `getDashboardOverview()` (`lib/dashboard/dashboard-overview.ts`) run server-side on `supabaseAdmin` — auth exists only in route handlers. Joumpa has a public endpoint already: `/api/joumpa/public`.
- **Existing exports/UI machinery to reuse:** `qrcode.react` dependency, `ReportsExportModal` patterns, `PresentationSlide.tsx`, `useJoumpaReports` hook, `PrismMultiSelect` filter pickers, dialog components (radix `@radix-ui/react-dialog`).
- **PWA/offline:** service worker exists; public share page should not depend on protected routes.

## 3. Data model

New Supabase table `published_dashboards`:

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `slug` | text unique not null | unguessable, `crypto.randomUUID()` (~36 chars) |
| `dashboard_key` | text not null | `analyst` \| `ocs` \| `os` \| `op` \| `ht` |
| `tab` | text not null | one of that dashboard's tabs, or `*` for whole dashboard |
| `name` | text | optional presentation name, e.g. "Q3 HUB CGK Performance" |
| `config` | jsonb not null | `{ scope: { dateRange?, dateFrom?, dateTo?, hubs[], stations[], airlines[], categories[], severity?, status? } }` |
| `created_by` | uuid null | auth uid when available |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `revoked_at` | timestamptz null | soft delete |

RLS:
- `created_by = auth.uid()` for insert/select/update/delete (owners only).
- Public read: a security definer function (or anon-policy scoped to `revoked_at IS NULL`) returning only `id, slug, dashboard_key, tab, name, config` for slug lookups — no owner metadata to the public.
- `revoked_at IS NULL` filter enforced in the route handler regardless of RLS.

## 4. API

**`/api/share`** (behind auth — owner only):

- `POST /api/share` — body `{ dashboardKey, tab, name?, config }`. Validates: `dashboardKey` + `tab` in allowed matrix (below), scope fields against master lists. Returns `{ slug, url }`.
- `GET /api/share?dashboardKey=<key>` — owner's active published links (manage list).
- `PATCH /api/share/[slug]` — update `config`/`name` (re-scope same link).
- `DELETE /api/share/[slug]` — revoke (sets `revoked_at`).

**Tab matrix** (which tabs exist per dashboard key; `*` always allowed):

| key | tabs |
|---|---|
| `analyst` | summary, sqi, joumpa, gse, cgo_cargo, delay, status_details |
| `ocs` / `os` | that dashboard's tab set (from its own tab component) |
| `op` | OPAnalystCharts set |
| `ht` | its tab set |

Unknown key/tab → 400. No arbitrary query strings can be injected via scope.

**Public** (no auth):
- `GET /api/share/[slug]` — metadata `{ dashboardKey, tab, name, config }` when active; 404 when missing/revoked. **Data is NOT served by this API** — the public page fetches server-side via libs (below).

## 5. Public route + read-only rendering

**Route `/share/[slug]/page.tsx`** — public server page (server component, `dynamic = 'force-dynamic'`). `proxy.ts` whitelist: add `path.startsWith('/share')`.

**Data fetch — new server-only module `lib/share/public-data.ts`:**
- Resolves `published_dashboards` row by slug (active only).
- `reports = reportsService.getReports({ source: 'sync' })`, then applies `config.scope` filters server-side (same filter semantics as authenticated global filters: hub, branch/station, airline, category, date range).
- `overview = getDashboardOverview()` for analytics; `availableOptions` derived from filtered reports.
- Joumpa reports via the same service the `/api/joumpa` route uses (or `/api/joumpa/public` shape) when `tab === 'joumpa'` or `tab === '*'`.
- Returns props shaped exactly like the authenticated dashboard consumes them.

**Read-only rendering — reuse the existing tree, add a `readOnly` prop:**
- `AnalystCharts`, `OPAnalystCharts`, `AnalyticsDashboard`, and `ChartSection` accept `readOnly?: boolean` (default `false` — authenticated behavior untouched).
- `readOnly` mode:
  - Hides the global filter bar, date-range control, drilldown actions, export buttons, report tables (raw data), "Load More".
  - Keeps charts, tooltips, internal sub-view toggles, and (only when `tab === '*'`) the tab bar. Per-tab share renders a locked single tab (no tab bar).
  - `onDrilldown`/`drilldownUrl` become no-ops; any component that navigates on drilldown is disabled in readOnly.
  - Global filter state initialized from `config.scope`; setter is a no-op (viewers cannot change scope).
- **Kiosk mode reuses the identical render** with `readOnly` — one code path, two entry points (public route server-fed; kiosk client-fed with the presenter's current filter state at launch).

**Public page shell:** own minimal layout (not `dashboard/layout.tsx`): Gapura logo header, read-only content, footer ("Shared via Gapura OneClick"). No sidebar, no app nav, no links into the app. Branded 404 for missing/revoked slugs.

## 6. Share dialog + publish flow

`ShareDashboardDialog` opened from a Share button in `DashboardHeader` (all dashboards) — beside existing header actions.

1. **Scope editor** (top): pre-filled from the dashboard's current filter state (date range + hub/station/airline/category pickers, reusing `PrismMultiSelect` + date controls). Optional presentation name field.
2. **Publish scope radio:** "Single tab" (dropdown of that dashboard's tabs) vs "Whole dashboard (all tabs)".
3. **Publish** → `POST /api/share` → success panel: public URL + QR code (`qrcode.react`) + copy button.
4. **Manage section:** list of active links for this dashboard — name, tab, scope summary, created date, actions: copy, **update scope** (re-open scope editor, `PATCH`), **revoke** (`DELETE`). Revoked links disappear from the list and 404 on the public route.

Presentation (kiosk) button sits next to Share in the header (icon: Presentation).

## 7. Kiosk (presentation) mode

- Fullscreen overlay (fixed inset-0, dark backdrop), no route change, no URL exposure.
- Renders the same `readOnly` view; scope = dashboard filter state at launch; the presenter can switch tabs via the visible tab bar (kiosk acts as `tab === '*'`).
- Exit: Esc + top-right close button (auto-hide with cursor idle). Uses browser Fullscreen API when available, plain overlay fallback.
- Data fetch failures inside kiosk: existing error-panel pattern + close always available.

## 8. Security

- Slugs: 12+ char unguessable (UUID) — link-only security model, approved.
- `proxy.ts` opens exactly `/share/:path*`; nothing else becomes public.
- Revoked slugs: 404, no existence hints.
- Scope validation server-side on publish (allowed tabs per dashboard key; filter values matched against master lists) — no arbitrary query injection.
- Public surface never exposes: raw report tables/rows, owner identity, sync internals, filenames, user names — only aggregated chart views.
- RLS: owners manage own rows; public reads limited to active records and safe columns.

## 9. Error handling

- Public page: missing/revoked → branded 404 ("This dashboard is no longer available"); data-fetch failure → retry + error panel (existing pattern).
- Publish dialog: inline validation; network errors retryable; no partial records (insert is single transaction).
- Kiosk: Esc exits even mid-fetch; error panel + close button.

## 10. Testing

- **API:** publish → GET public metadata → revoke → GET 404; invalid dashboardKey/tab → 400; scope validation rejections; RLS matrix (owner vs other authenticated user vs anon).
- **Public page:** smoke per tab (all 7 analyst tabs + OCS/OS/OP variants); scope filters applied; `readOnly` hides filter bar/drilldown/export/tables; tab bar hidden for per-tab links, visible for `*`.
- **Kiosk:** open/close, Esc, tab switching, filter bar absent.
- **Regression:** authenticated dashboards unchanged (`readOnly` defaults false); `/embed` and auth flows untouched.

## 11. Out of scope

- Passcode/email-gated links (link-only, approved).
- Snapshot publishing (live data only).
- Builder dashboards (`custom_dashboards`) — existing publish mechanism untouched.
- Public mobile polish beyond responsive baseline (kiosk is desktop-first; public page responsive).
