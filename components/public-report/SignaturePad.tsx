'use client';

import { forwardRef, useRef, useEffect, useCallback, useState, useImperativeHandle } from 'react';

interface SignaturePadProps {
  onChange?: (dataUrl: string | null) => void;
  width?: number;
  height?: number;
  className?: string;
}

export interface SignaturePadHandle {
  getSignature: () => string | null;
  clear: () => void;
}

interface Point {
  x: number;
  y: number;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad(
  { onChange, width = 400, height = 120, className = '' },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef<Point | null>(null);
  const hasStrokes = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const getCtx = useCallback((): CanvasRenderingContext2D | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1a2e44';
  }, []);

  const getPointFromEvent = (e: PointerEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = useCallback((e: PointerEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    isDrawing.current = true;
    lastPoint.current = getPointFromEvent(e);
    const ctx = getCtx();
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
  }, [getCtx]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx || !lastPoint.current) return;
    const current = getPointFromEvent(e);

    const midX = (lastPoint.current.x + current.x) / 2;
    const midY = (lastPoint.current.y + current.y) / 2;
    ctx.quadraticCurveTo(lastPoint.current.x, lastPoint.current.y, midX, midY);
    ctx.stroke();
    lastPoint.current = current;
  }, [getCtx]);

  const onPointerUp = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    lastPoint.current = null;
    hasStrokes.current = true;
    setIsEmpty(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange?.(canvas.toDataURL('image/png'));
  }, [onChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    };
  }, [onPointerDown, onPointerMove, onPointerUp]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    hasStrokes.current = false;
    setIsEmpty(true);
    onChange?.(null);
  }, [getCtx, onChange]);

  useImperativeHandle(ref, () => ({
    getSignature: () => {
      const canvas = canvasRef.current;
      if (!canvas || !hasStrokes.current) return null;
      return canvas.toDataURL('image/png');
    },
    clear,
  }), [clear]);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="relative rounded-xl overflow-hidden border-2 border-dashed border-slate-300 bg-white hover:border-blue-400 transition-colors cursor-crosshair group">
        <canvas
          ref={canvasRef}
          style={{ width: '100%', maxWidth: `${width}px`, height: `${height}px`, display: 'block', touchAction: 'none' }}
        />
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-xs font-medium text-slate-400 select-none">Sign here</p>
          </div>
        )}
      </div>
      {!isEmpty && (
        <button
          type="button"
          onClick={clear}
          className="self-end text-xs text-red-500 hover:text-red-700 font-semibold underline transition-colors"
        >
          Clear Signature
        </button>
      )}
    </div>
  );
});
