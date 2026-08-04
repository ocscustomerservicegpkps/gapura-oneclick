
'use client';

import { useState, useEffect } from 'react';

export interface ViewportState {

  isMobile: boolean;

  isTablet: boolean;

  isDesktop: boolean;

  isVeryLargeDesktop: boolean;

  width: number;

  height: number;
}

export function useViewport(): ViewportState {
  const [viewport, setViewport] = useState<ViewportState>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isVeryLargeDesktop: false,
    width: 1920,
    height: 1080,
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

    setViewport({
      isMobile: width <= 768,
      isTablet: width > 768 && width <= 1024,
      isDesktop: width > 1024 && width <= 1536,
      isVeryLargeDesktop: width > 1536,
      width,
      height,
    });
    };

    handleResize();

    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return viewport;
}

export function useMobileCharts(): boolean {
  const { isMobile, isTablet } = useViewport();
  return isMobile || isTablet;
}

export default useViewport;
