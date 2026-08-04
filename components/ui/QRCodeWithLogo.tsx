'use client';

import { QRCodeSVG } from 'qrcode.react';

interface QRCodeWithLogoProps {
  value: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
  level?: 'L' | 'M' | 'Q' | 'H';
  logoSize?: number;
  className?: string;
}

export function QRCodeWithLogo({
  value,
  size = 156,
  fgColor = '#0ea5a6',
  bgColor = '#ffffff',
  level = 'H',
  logoSize,
  className,
}: QRCodeWithLogoProps) {

  const actualLogoSize = logoSize || Math.floor(size * 0.25);

  return (
    <div className={className}>
      <QRCodeSVG
        value={value}
        size={size}
        fgColor={fgColor}
        bgColor={bgColor}
        level={level}
        imageSettings={{
          src: '/logo.png',
          x: undefined,
          y: undefined,
          height: actualLogoSize,
          width: actualLogoSize,
          excavate: true,
        }}
      />
    </div>
  );
}

export default QRCodeWithLogo;
