import { useEffect, useRef } from "react";

interface Props {
  analyser: AnalyserNode | undefined;
  color: string;
  isPlaying: boolean;
  isActive: boolean;
}

export default function WaveVisualizer({
  analyser,
  color,
  isPlaying,
  isActive,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d")!;
    let animationId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height;

        if (isActive && isPlaying) {
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.8;
        } else {
          ctx.fillStyle = "#475569";
          ctx.globalAlpha = 0.2;
        }

        ctx.fillRect(x, height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [analyser, color, isPlaying, isActive]);

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={60}
      style={{
        width: "100%",
        height: "60px",
        borderRadius: "4px",
        background: "rgba(0,0,0,0.2)",
      }}
    />
  );
}
