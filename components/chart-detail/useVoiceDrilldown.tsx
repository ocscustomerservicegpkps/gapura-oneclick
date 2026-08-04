import { useState, useCallback } from 'react';
import { VoiceDrilldownDrawer } from './VoiceDrilldownDrawer';

export interface VoiceDrawerRecord {
  timestamp?: string;
  email?: string;
  date?: string;
  airlines?: string;
  flightNumber?: string;
  branch?: string;
  serviceType?: string;
  category?: string;
  evidence?: string;
  evidence_urls?: string[];
  report?: string;
  reportBy?: string;
  reportType?: string;
  satisfactionRating?: string;
  averageRating?: string;
  [key: string]: unknown;
}

export function useVoiceDrilldown() {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [data, setData] = useState<VoiceDrawerRecord[]>([]);

  const openDrilldown = useCallback((newData: VoiceDrawerRecord[], newTitle: string) => {
    setData(newData);
    setTitle(newTitle);
    setIsOpen(true);
  }, []);

  const DrilldownRenderer = () => (
    <VoiceDrilldownDrawer
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title={title}
      data={data}
    />
  );

  return {
    openDrilldown,
    DrilldownRenderer,
  };
}
