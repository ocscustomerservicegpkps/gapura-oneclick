/**
 * @file
 * Centralized external links configuration module.
 *
 * All external URLs used across the app are defined here as defaults.
 * The Super Admin can override any URL via the external_links database table.
 * If the DB is unavailable, hardcoded defaults are used as fallback.
 */

export interface ExternalLinkEntry {
  id: string;
  label: string;
  url: string;
  category: string;
  description: string;
}

export type ExternalLinksMap = Record<string, ExternalLinkEntry>;

/**
 * Category display labels for the admin UI
 */
export const CATEGORY_LABELS: Record<string, string> = {
  google_forms: 'Google Forms',
  looker_studio: 'Looker Studio Dashboards',
  other: 'Other External Links',
};

/**
 * All default external links — matches the seed migration exactly.
 * This is the fallback when the database is empty or unavailable.
 */
export const DEFAULT_EXTERNAL_LINKS: ExternalLinksMap = {
  // ── Google Forms ──────────────────────────────────────────────
  'customer-joumpa': {
    id: 'customer-joumpa',
    label: 'Customer JOUMPA',
    url: 'https://forms.gle/gQpqWn2eSRqSsoJt7',
    category: 'google_forms',
    description: 'Customer JOUMPA feedback form',
  },
  'staff-joumpa': {
    id: 'staff-joumpa',
    label: 'Staff JOUMPA',
    url: 'https://forms.gle/QTP5vvwbmJxDroSB7',
    category: 'google_forms',
    description: 'Staff JOUMPA feedback form',
  },
  'survey-penumpang': {
    id: 'survey-penumpang',
    label: 'Survey Penumpang',
    url: 'https://forms.gle/G5T9yx2MBSWdXtJE7',
    category: 'google_forms',
    description: 'Survey kepuasan penumpang',
  },
  'sla-landside': {
    id: 'sla-landside',
    label: 'SLA Landside',
    url: 'https://docs.google.com/forms/d/e/1FAIpQLSeu3mRk2R_V-m9lBIn9704Kx6u3_p3d8pT80p3/viewform',
    category: 'google_forms',
    description: 'Form pengisian SLA Landside (Quick Access)',
  },
  'sla-airside': {
    id: 'sla-airside',
    label: 'SLA Airside',
    url: 'https://docs.google.com/forms/d/e/1FAIpQLSeu3mRk2R_V-m9lBIn9704Kx6u3_p3d8pT80p3/viewform',
    category: 'google_forms',
    description: 'Form pengisian SLA Airside (Quick Access)',
  },
  'sla-landside-page': {
    id: 'sla-landside-page',
    label: 'SLA Landside (Page)',
    url: 'https://docs.google.com/forms/d/e/1FAIpQLSdMQgVrgWaPagVy7WEB94iVfC5rJmrxw5-J1Tn6jAJ77cD9Uw/closedform',
    category: 'google_forms',
    description: 'Form SLA Landside (halaman dedicated)',
  },
  'sla-airside-page': {
    id: 'sla-airside-page',
    label: 'SLA Airside (Page)',
    url: 'https://docs.google.com/forms/d/e/1FAIpQLSeTpTECPvbI_mPquwTq2egIbiJ2_pQ3LEowH-1pv2Mo3SVWEA/viewform',
    category: 'google_forms',
    description: 'Form SLA Airside (halaman dedicated)',
  },
  'staff-joumpa-report': {
    id: 'staff-joumpa-report',
    label: 'Staff JOUMPA Report',
    url: 'https://forms.gle/oLyEBoThQKbjPLAk9',
    category: 'google_forms',
    description: 'Staff JOUMPA Report form (GuestNav)',
  },

  // ── Looker Studio Dashboards ──────────────────────────────────
  'wsn-monitor': {
    id: 'wsn-monitor',
    label: 'Weekly Service Notice',
    url: 'https://linktr.ee/unitservicekps',
    category: 'other',
    description: 'Weekly Service Notice link',
  },
  'wsn-weekly': {
    id: 'wsn-weekly',
    label: 'Weekly Service Notice',
    url: 'https://linktr.ee/unitservicekps',
    category: 'other',
    description: 'Weekly Service Notice link',
  },
  'joumpa-dashboard': {
    id: 'joumpa-dashboard',
    label: 'JOUMPA Customer Feedback Dashboard',
    url: 'https://lookerstudio.google.com/reporting/6a7aba44-6bd1-439f-a5d2-8bed4af56448',
    category: 'looker_studio',
    description: 'JOUMPA service analytics dashboard',
  },
  'joumpa-customer-survey': {
    id: 'joumpa-customer-survey',
    label: 'JOUMPA Customer Survey',
    url: 'https://datastudio.google.com/reporting/5b6c5154-d9d1-41ea-a325-afa96f58f74b',
    category: 'looker_studio',
    description: 'JOUMPA Customer Survey Looker Studio dashboard',
  },
  'customer-feedback': {
    id: 'customer-feedback',
    label: 'Customer Feedback Dashboard',
    url: 'https://lookerstudio.google.com/reporting/1afa362c-347e-44cd-98b1-0ec29abbb333',
    category: 'looker_studio',
    description: 'Customer feedback analytics dashboard',
  },
  'op-initial-irregularity': {
    id: 'op-initial-irregularity',
    label: 'OP Initial Irregularity',
    url: 'https://lookerstudio.google.com/reporting/06d31553-08c6-42f3-81e6-1bc96356a854/page/tKISF',
    category: 'looker_studio',
    description: 'OP initial irregularity dashboard',
  },
  'os-dashboard-analyst': {
    id: 'os-dashboard-analyst',
    label: 'OS Dashboard (Analyst)',
    url: 'https://lookerstudio.google.com/reporting/55737b14-c27a-4ed8-b65c-336317790314',
    category: 'looker_studio',
    description: 'OS division dashboard for analyst view',
  },
  'service-dashboard-analyst': {
    id: 'service-dashboard-analyst',
    label: 'Service Dashboard (Analyst)',
    url: 'https://lookerstudio.google.com/reporting/55737b14-c27a-4ed8-b65c-336317790314',
    category: 'looker_studio',
    description: 'Service division dashboard for analyst view',
  },
  'analyst-joumpa': {
    id: 'analyst-joumpa',
    label: 'Analyst JOUMPA Link',
    url: 'https://lookerstudio.google.com/reporting/6a7aba44-6bd1-439f-a5d2-8bed4af56448',
    category: 'looker_studio',
    description: 'JOUMPA link in analyst dashboard',
  },
  'analyst-op-weekly': {
    id: 'analyst-op-weekly',
    label: 'OP Weekly Dashboard',
    url: 'https://lookerstudio.google.com/u/0/reporting/55737b14-c27a-4ed8-b65c-336317790314/page/p_qqvwkh1hsd',
    category: 'looker_studio',
    description: 'OP weekly dashboard in analyst view',
  },
  'analyst-sla-dashboard': {
    id: 'analyst-sla-dashboard',
    label: 'SLA Dashboard',
    url: 'https://lookerstudio.google.com/u/0/reporting/55737b14-c27a-4ed8-b65c-336317790314/page/p_etgy5p9ptd',
    category: 'looker_studio',
    description: 'SLA dashboard in analyst view',
  },
  'analyst-branch-perf': {
    id: 'analyst-branch-perf',
    label: 'Branch Performance',
    url: 'https://lookerstudio.google.com/u/6/reporting/55737b14-c27a-4ed8-b65c-336317790314/page/p_uyfwmq7usd',
    category: 'looker_studio',
    description: 'Branch performance dashboard in analyst view',
  },

  // ── Other External Links ──────────────────────────────────────
  'handbook-sla': {
    id: 'handbook-sla',
    label: 'Handbook SLA',
    url: 'https://sis.appsdev.my.id/',
    category: 'other',
    description: 'SLA Handbook aplikasi panduan layanan',
  },
  'ai-virtual-assistant': {
    id: 'ai-virtual-assistant',
    label: 'AI Virtual Assistant',
    url: 'https://gapura-dev-gapura-rag.hf.space/',
    category: 'other',
    description: 'AI Virtual Assistant powered by Gapura RAG',
  },
  'hsse-report': {
    id: 'hsse-report',
    label: 'HSSE Report',
    url: 'https://forms.office.com/pages/responsepage.aspx?id=UN958i0U-k6wuwHqZRjbWCdrrO6qSgFPtKjbarMtEydUN0ZaM0tJODFONktURkpZUE45TFpNQ1hJOC4u&origin=lprLink&route=shorturl',
    category: 'other',
    description: 'HSSE Report form (Quick Access)',
  },
  'hsse-report-guestnav': {
    id: 'hsse-report-guestnav',
    label: 'HSSE Report (Nav)',
    url: 'https://linktr.ee/HSSE_GP',
    category: 'other',
    description: 'HSSE Report link (GuestNav)',
  },
  'ai-docs': {
    id: 'ai-docs',
    label: 'AI Docs',
    url: 'https://gapura-dev-gapura-ai.hf.space/docs',
    category: 'other',
    description: 'AI service API documentation',
  },
  'chat-bot-openai': {
    id: 'chat-bot-openai',
    label: 'Chat Bot OpenAI',
    url: 'https://app.openai.com/',
    category: 'other',
    description: 'OpenAI Chat Bot link (GuestNav)',
  },
};

/**
 * Get a single URL by link ID.
 * Always falls back to DEFAULT_EXTERNAL_LINKS if the map is null or missing the key.
 */
export function getLinkUrl(links: ExternalLinksMap | null, id: string): string {
  return links?.[id]?.url || DEFAULT_EXTERNAL_LINKS[id]?.url || '#';
}

// NOTE: getExternalLinks() (server-side DB query) lives in lib/external-links-server.ts
// to avoid importing supabaseAdmin (which depends on 'server-only') into client bundles.
