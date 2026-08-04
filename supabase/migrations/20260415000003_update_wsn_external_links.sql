UPDATE public.external_links
SET
  label = 'Weekly Service Notice',
  url = 'https://linktr.ee/unitservicekps',
  category = 'other',
  description = 'Weekly Service Notice link'
WHERE id IN ('wsn-monitor', 'wsn-weekly');
