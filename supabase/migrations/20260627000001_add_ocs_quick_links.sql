CREATE TABLE IF NOT EXISTS public.ocs_quick_links (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  label       TEXT        NOT NULL,
  url         TEXT        NOT NULL,
  color       TEXT        NOT NULL DEFAULT 'emerald',
  icon        TEXT        NOT NULL DEFAULT 'link',
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_by  UUID,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ocs_quick_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ocs_quick_links_auth"
  ON public.ocs_quick_links FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

INSERT INTO public.ocs_quick_links (label, url, color, icon, sort_order) VALUES
  ('JOUMPA',       'https://lookerstudio.google.com/reporting/6a7aba44-6bd1-439f-a5d2-8bed4af56448',                                                    'emerald', 'layout-dashboard', 1),
  ('OS Dashboard', 'https://lookerstudio.google.com/reporting/55737b14-c27a-4ed8-b65c-336317790314',                                                    'slate',   'link',             2),
  ('Survey',       'https://lookerstudio.google.com/u/0/reporting/55737b14-c27a-4ed8-b65c-336317790314/page/p_qqvwkh1hsd',                              'blue',    'bar-chart',        3),
  ('SLA',          'https://lookerstudio.google.com/u/0/reporting/55737b14-c27a-4ed8-b65c-336317790314/page/p_etgy5p9ptd',                              'violet',  'clock',            4),
  ('WSN',          '/dashboard/ocs/wsn',                                                                                                                 'cyan',    'layout-grid',      5),
  ('About OS',     'https://lookerstudio.google.com/u/6/reporting/55737b14-c27a-4ed8-b65c-336317790314/page/p_uyfwmq7usd',                              'amber',   'folder-open',      6);
