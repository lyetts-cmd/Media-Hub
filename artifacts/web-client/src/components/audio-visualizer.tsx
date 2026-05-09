import React, { useRef, useEffect } from "react";

interface Props {
  analyserNode: AnalyserNode | null;
  isPlaying: boolean;
  isExpanded?: boolean;
  barCount?: number;
  className?: string;
}

export default function AudioVisualizer({ analyserNode, isPlaying, isExpanded = false, barCount = 48, className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number | undefined>(undefined);
  const idleFrame = useRef(0);
  const lastDrawRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (analyserNode) {
      analyserNode.fftSize = isExpanded ? 2048 : 512;
    }

    const dataArray = analyserNode
      ? new Uint8Array(analyserNode.frequencyBinCount)
      : new Uint8Array(barCount);

    const FRAME_INTERVAL = 1000 / 30;

    const draw = (timestamp: number) => {
      rafRef.current = requestAnimationFrame(draw);

      const elapsed = timestamp - lastDrawRef.current;
      if (elapsed < FRAME_INTERVAL) return;
      lastDrawRef.current = timestamp - (elapsed % FRAME_INTERVAL);

      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      if (analyserNode && isPlaying) {
        analyserNode.getByteFrequencyData(dataArray);
        idleFrame.current = 0;
      } else {
        idleFrame.current++;
        const t = idleFrame.current * 0.04;
        for (let i = 0; i < barCount; i++) {
          dataArray[i] = Math.max(4, 12 + Math.sin(t + i * 0.5) * 8 + Math.sin(t * 1.3 + i * 0.3) * 4);
        }
      }

      const step    = Math.floor(dataArray.length / barCount);
      const barW    = W / barCount;
      const gap     = Math.max(1, barW * 0.2);
      const actualW = barW - gap;

      for (let i = 0; i < barCount; i++) {
        const value  = dataArray[i * step] / 255;
        const barH   = Math.max(2, value * H * 0.92);
        const x      = i * barW + gap / 2;
        const y      = H - barH;

        const alpha  = isPlaying ? 0.85 + value * 0.15 : 0.35;
        const cr     = Math.round(120 + value * 60);
        const cg     = Math.round(40  + value * 20);
        const cb     = Math.round(220 + value * 35);

        const grad = ctx.createLinearGradient(0, y, 0, H);
        grad.addColorStop(0,   `rgba(${cr},${cg},${cb},${alpha})`);
        grad.addColorStop(1,   `rgba(${cr},${cg},${cb},0.2)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        const rad = Math.min(actualW / 2, 3);
        if (ctx.roundRect) {
          ctx.roundRect(x, y, actualW, barH, [rad, rad, 1, 1]);
        } else {
          ctx.rect(x, y, actualW, barH);
        }
        ctx.fill();
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyserNode, isPlaying, isExpanded, barCount]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={120}
      className={`w-full h-full ${className}`}
    />
  );
}
