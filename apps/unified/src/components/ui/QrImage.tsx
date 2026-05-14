import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface Props {
  value: string;
  size?: number;
  className?: string;
}

export function QrImage({ value, size = 200, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, value, { width: size, margin: 2 });
  }, [value, size]);

  return <canvas ref={canvasRef} className={className} />;
}
