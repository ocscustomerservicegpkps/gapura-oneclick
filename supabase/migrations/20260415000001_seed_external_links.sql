-- Seed external_links with all current hardcoded URLs
-- These match the DEFAULT_EXTERNAL_LINKS in lib/external-links.ts

INSERT INTO public.external_links (id, label, url, category, description, sort_order) VALUES
-- Google Forms
('customer-joumpa', 'Customer JOUMPA', 'https://forms.gle/gQpqWn2eSRqSsoJt7', 'google_forms', 'Customer JOUMPA feedback form', 1),
('staff-joumpa', 'Staff JOUMPA', 'https://forms.gle/QTP5vvwbmJxDroSB7', 'google_forms', 'Staff JOUMPA feedback form', 2),
('survey-penumpang', 'Survey Penumpang', 'https://forms.gle/G5T9yx2MBSWdXtJE7', 'google_forms', 'Survey kepuasan penumpang', 3),
('sla-landside', 'SLA Landside', 'https://docs.google.com/forms/d/e/1FAIpQLSeu3mRk2R_V-m9lBIn9704Kx6u3_p3d8pT80p3/viewform', 'google_forms', 'Form pengisian SLA Landside (Quick Access)', 4),
('sla-airside', 'SLA Airside', 'https://docs.google.com/forms/d/e/1FAIpQLSeu3mRk2R_V-m9lBIn9704Kx6u3_p3d8pT80p3/viewform', 'google_forms', 'Form pengisian SLA Airside (Quick Access)', 5),
('sla-landside-page', 'SLA Landside (Page)', 'https://docs.google.com/forms/d/e/1FAIpQLSdMQgVrgWaPagVy7WEB94iVfC5rJmrxw5-J1Tn6jAJ77cD9Uw/closedform', 'google_forms', 'Form SLA Landside (halaman dedicated)', 6),
('sla-airside-page', 'SLA Airside (Page)', 'https://docs.google.com/forms/d/e/1FAIpQLSeTpTECPvbI_mPquwTq2egIbiJ2_pQ3LEowH-1pv2Mo3SVWEA/viewform', 'google_forms', 'Form SLA Airside (halaman dedicated)', 7),
('staff-joumpa-report', 'Staff JOUMPA Report', 'https://forms.gle/oLyEBoThQKbjPLAk9', 'google_forms', 'Staff JOUMPA Report form (GuestNav)', 8),

-- Looker Studio Dashboards
('wsn-monitor', 'Weekly Service Notice', 'https://linktr.ee/unitservicekps', 'other', 'Weekly Service Notice link', 1),
('wsn-weekly', 'Weekly Service Notice', 'https://linktr.ee/unitservicekps', 'other', 'Weekly Service Notice link', 2),
('joumpa-dashboard', 'JOUMPA Dashboard', 'https://lookerstudio.google.com/reporting/6a7aba44-6bd1-439f-a5d2-8bed4af56448', 'looker_studio', 'JOUMPA service analytics dashboard', 3),
('customer-feedback', 'Customer Feedback Dashboard', 'https://lookerstudio.google.com/reporting/1afa362c-347e-44cd-98b1-0ec29abbb333', 'looker_studio', 'Customer feedback analytics dashboard', 4),
('op-initial-irregularity', 'OP Initial Irregularity', 'https://lookerstudio.google.com/reporting/06d31553-08c6-42f3-81e6-1bc96356a854/page/tKISF', 'looker_studio', 'OP initial irregularity dashboard', 5),
('os-dashboard-analyst', 'OS Dashboard (Analyst)', 'https://lookerstudio.google.com/reporting/55737b14-c27a-4ed8-b65c-336317790314', 'looker_studio', 'OS division dashboard for analyst view', 6),
('service-dashboard-analyst', 'Service Dashboard (Analyst)', 'https://lookerstudio.google.com/reporting/55737b14-c27a-4ed8-b65c-336317790314', 'looker_studio', 'Service division dashboard for analyst view', 7),
('analyst-joumpa', 'Analyst JOUMPA Link', 'https://lookerstudio.google.com/reporting/6a7aba44-6bd1-439f-a5d2-8bed4af56448', 'looker_studio', 'JOUMPA link in analyst dashboard', 8),
('analyst-op-weekly', 'OP Weekly Dashboard', 'https://lookerstudio.google.com/u/0/reporting/55737b14-c27a-4ed8-b65c-336317790314/page/p_qqvwkh1hsd', 'looker_studio', 'OP weekly dashboard in analyst view', 9),
('analyst-ot-dashboard', 'OT Dashboard', 'https://lookerstudio.google.com/u/0/reporting/55737b14-c27a-4ed8-b65c-336317790314/page/p_etgy5p9ptd', 'looker_studio', 'OT division dashboard in analyst view', 10),
('analyst-branch-perf', 'Branch Performance', 'https://lookerstudio.google.com/u/6/reporting/55737b14-c27a-4ed8-b65c-336317790314/page/p_uyfwmq7usd', 'looker_studio', 'Branch performance dashboard in analyst view', 11),

-- Other External Links
('handbook-sla', 'Handbook SLA', 'https://sis.appsdev.my.id/', 'other', 'SLA Handbook aplikasi panduan layanan', 1),
('ai-virtual-assistant', 'AI Virtual Assistant', 'https://gapura-dev-gapura-rag.hf.space/', 'other', 'AI Virtual Assistant powered by Gapura RAG', 2),
('hsse-report', 'HSSE Report', 'https://forms.office.com/pages/responsepage.aspx?id=UN958i0U-k6wuwHqZRjbWCdrrO6qSgFPtKjbarMtEydUN0ZaM0tJODFONktURkpZUE45TFpNQ1hJOC4u&origin=lprLink&route=shorturl', 'other', 'HSSE Report form (Quick Access)', 3),
('hsse-report-guestnav', 'HSSE Report (Nav)', 'https://linktr.ee/HSSE_GP', 'other', 'HSSE Report link (GuestNav)', 4),
('ai-docs', 'AI Docs', 'https://gapura-dev-gapura-ai.hf.space/docs', 'other', 'AI service API documentation', 5),
('chat-bot-openai', 'Chat Bot OpenAI', 'https://app.openai.com/', 'other', 'OpenAI Chat Bot link (GuestNav)', 6)
ON CONFLICT (id) DO NOTHING;
