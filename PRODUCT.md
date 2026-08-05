# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Division teams** (OCS, OS, OP, OT, UQ, HC, HT, Eskalasi — both DIVISI_ and PARTNER_ roles): enter, monitor, and follow up on operational irregularity reports within their division scope.
- **Analysts** (ANALYST role, company-wide visibility): analyze and present the full report corpus through the dashboard tabs (Summary Report, Detail Report, Joumpa Service, GSE Performance, CGO Cargo, Delay Code, Reports Status).
- **Branch managers and staff** (MANAGER_CABANG / STAFF_CABANG / CABANG): branch-level reporting, station-locked views, user approvals.
- **Super admins**: user management, system configuration, sync administration.

## Product Purpose

Track, monitor, and analyze ground-handling irregularity reports (incidents, complaints, compliments) across hubs, branches, and airlines in near real time. Report data is synced from Google Sheets and the JOUMPA system; the app layers monitoring, analytics, and document production (Excel, PDF, DOCX, PPTX exports) over that corpus. The future shared-dashboard feature additionally serves **internal stakeholders without logins** who only need read-only views of published dashboards.

## Positioning

A single operational reporting platform ("One Click Irregularity Report") for an Indonesian ground-handling provider: the source of truth for irregularity status, service quality, and division accountability — replacing ad-hoc spreadsheet circulation with a unified, role-scoped, always-current view.

## Operating Context

- Indonesian ground-handling operations; UI copy is Indonesian/English mixed (e.g., "Kategori", "Maskapai", "HUB", "Station").
- WIB timezone (UTC+7) matters: date inputs are computed in local time, never UTC.
- Data lands continuously: Google Sheets webhook sync (`/api/integrations/google-sheets/webhook`) and scheduled JOUMPA sync jobs; dashboards show live data, not snapshots.
- Presentation is a first-class activity (PPTX export, `PresentationSlide` components) — analysts present to stakeholders.
- Demo mode (`DEMO_MODE=true`) exists for evaluation without login.

## Capabilities and Constraints

- **Auth:** custom JWT session (`session` cookie, `JWT_SECRET`), verified in `proxy.ts` middleware; role-scoped routing per role (`ROLE_DASHBOARDS`); station-lock for branch users; session eviction cache.
- **Public surfaces (no login):** `/embed/*` (chart embeds, custom dashboards by slug), GET `/api/dashboards`, `/api/reports/public`, `/api/joumpa/public`, `/api/master-data`; everything else requires a session.
- **Data layer:** Supabase (Postgres) via `supabaseAdmin` service; `reportsService` is session-free and shared by server routes and `getDashboardOverview`.
- **Dashboards:** shared shell `DivisionAnalystDashboard` → `ChartSection` → `AnalystCharts` / `OPAnalystCharts` (analyst, OS, OP, division dashboards); `AnalyticsDashboard` for OCS. Chart datasets are computed client-side from the reports array.
- **Sync:** Google Sheets (googleapis) webhook + scheduled sync scripts (`scripts/sync-scheduler.mjs`, `sync-joumpa-scheduler.mjs`); `custom_dashboards` table with `slug` + `is_public` for published builder dashboards.
- **Exports:** Excel (exceljs), PDF (jspdf), DOCX (docx), PPTX (pptxgenjs), image (html-to-image); `qrcode.react` available.
- **PWA:** service worker (`build:sw`), offline page, mobile responsive; Android asset links.
- **Terminology:** IRRS namespace UUID `6ba7b810-9dad-11d1-80b4-00c04fd430c8`; report categories: GSE, CGO, delay codes; statuses OPEN/CLOSED; severity levels TOP/HIGH/CRITICAL.

## Brand Commitments

- Name: **Gapura OneClick** ("gapura-oneclick").
- Visual system: emerald green brand primary, oklch token CSS variables (`--brand-primary`, `--surface-*`, `--text-*`), rounded-2xl cards, dark-glass surfaces, Prism UI components (shadcn-style). Gapura logo (`/logo.png`).
- No externally-verified claims about service levels, pricing, or customers in product copy — do not fabricate.

## Evidence on Hand

- Real production corpus in Supabase (reports, joumpa data, users) — do not fabricate data in designs.
- `/logo.png` logo asset; auth theme CSS (`app/auth/auth-theme.css`) with aurora/noise aesthetic used by public auth pages.
- No DESIGN.md yet — visual system exists only in code (tokens in `tailwind.config.js`, CSS vars in component styles).

## Product Principles

1. **Live data wins.** Users act on the current state of operations; never present snapshots as truth.
2. **Role scope is sacred.** Data access is gated per role, division, and station — shared/public views must be explicitly scoped by the sharer.
3. **One source of truth.** Sheets/JOUMPA sync into Supabase; every view derives from the same report corpus.
4. **Presentation-ready.** Stakeholder audiences are the point — exports, slides, and (new) shared read-only dashboards are first-class.
5. **Analyst dashboards are the showcase.** The tab bar (Summary, Detail, Joumpa, GSE, CGO, Delay, Status) is the flagship surface users share.

## Accessibility & Inclusion

No product-specific accessibility standard established yet. UI uses semantic HTML, aria labels on interactive elements, and keyboard-reachable controls in existing components; maintain that baseline for new surfaces.
