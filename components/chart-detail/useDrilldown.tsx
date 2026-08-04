import { useState, useCallback } from 'react';
import { DrilldownDrawer } from './DrilldownDrawer';

export function useDrilldown() {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openDrilldown = useCallback((newData: any[], newTitle: string) => {
    setData(newData);
    setTitle(newTitle);
    setIsOpen(true);
  }, []);

  const DrilldownRenderer = () => (
    <DrilldownDrawer
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
