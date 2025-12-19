import { useEffect, useRef, useState, type ReactNode, type MouseEvent } from 'react';

interface MirrorButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Хромированная кнопка с реалистичным 3D эффектом вмятины.
 */
export function MirrorButton({ 
  children, 
  onClick, 
  className = '',
  disabled = false 
}: MirrorButtonProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isPressed, setIsPressed] = useState(false);
  const animationRef = useRef<number>();

  useEffect(() => {
    let stream: MediaStream | null = null;

    const initCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 480 },
            height: { ideal: 270 },
            facingMode: 'user'
          }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setHasCamera(true);
        }
      } catch (err) {
        console.log('Camera not available:', err);
        setHasCamera(false);
      }
    };

    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const handleMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  };

  // Обработка видео
  useEffect(() => {
    if (!hasCamera) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const processFrame = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          let r = data[i];
          let g = data[i + 1];
          let b = data[i + 2];

          const contrast = 1.15;
          r = (r - 128) * contrast + 128;
          g = (g - 128) * contrast + 128;
          b = (b - 128) * contrast + 128;
          
          const gray = r * 0.299 + g * 0.587 + b * 0.114;
          const saturation = 0.6;
          r = gray + (r - gray) * saturation;
          g = gray + (g - gray) * saturation;
          b = gray + (b - gray) * saturation;
          
          r *= 0.95;
          b *= 1.05;
          
          data[i] = Math.max(0, Math.min(255, r));
          data[i + 1] = Math.max(0, Math.min(255, g));
          data[i + 2] = Math.max(0, Math.min(255, b));
        }

        ctx.putImageData(imageData, 0, 0);
      }

      animationRef.current = requestAnimationFrame(processFrame);
    };

    processFrame();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [hasCamera]);

  // Параметры вмятины (маленькая, как от пальца)
  const dentRadius = isPressed ? 12 : 9;
  const dentDepth = isPressed ? 1.2 : 0.85;

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
      onMouseMove={handleMouseMove}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      className={`
        relative overflow-hidden
        px-6 py-3 rounded-xl
        font-semibold
        active:scale-[0.98]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
        ${className}
      `}
      style={{
        background: `linear-gradient(180deg, 
          #c5c5c5 0%,
          #d8d8d8 20%,
          #a8a8a8 45%,
          #888888 55%,
          #a0a0a0 70%,
          #b8b8b8 85%,
          #c0c0c0 100%
        )`,
        boxShadow: isHovered
          ? `
            0 0 0 1px rgba(255,255,255,0.6),
            0 1px 0 rgba(255,255,255,0.8) inset,
            0 -1px 0 rgba(0,0,0,0.15) inset,
            0 12px 30px -10px rgba(0,0,0,0.35)
          `
          : `
            0 0 0 1px rgba(255,255,255,0.4),
            0 1px 0 rgba(255,255,255,0.6) inset,
            0 -1px 0 rgba(0,0,0,0.1) inset,
            0 6px 15px -6px rgba(0,0,0,0.25)
          `,
        transform: isHovered 
          ? `perspective(800px) rotateX(${(mousePos.y - 50) * 0.05}deg) rotateY(${(mousePos.x - 50) * -0.05}deg) scale(1.015)`
          : 'perspective(800px) scale(1)',
        transition: 'transform 0.1s ease-out, box-shadow 0.2s ease-out',
      }}
    >
      {/* Скрытое видео */}
      <video ref={videoRef} className="hidden" muted playsInline />

      {/* Отражение с камеры */}
      {hasCamera && (
        <canvas
          ref={canvasRef}
          width={480}
          height={270}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none rounded-xl"
          style={{
            mixBlendMode: 'soft-light',
            opacity: isHovered ? 0.7 : 0.5,
          }}
        />
      )}

      {/* Базовый градиент глубины */}
      <div 
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          background: `linear-gradient(180deg,
            rgba(255,255,255,0.2) 0%,
            rgba(255,255,255,0.05) 30%,
            transparent 45%,
            transparent 55%,
            rgba(0,0,0,0.05) 70%,
            rgba(0,0,0,0.1) 100%
          )`,
        }}
      />

      {/* Верхний блик */}
      <div 
        className="absolute top-0 left-[5%] right-[5%] h-[25%] rounded-t-lg pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
        }}
      />

      {/* ===== ЭФФЕКТ ВМЯТИНЫ ===== */}
      {isHovered && (
        <>
          {/* 1. Основная тень вмятины (центр углубления) */}
          <div 
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background: `radial-gradient(
                ellipse ${dentRadius}% ${dentRadius * 0.65}% at ${mousePos.x}% ${mousePos.y}%,
                rgba(0,0,0,${0.35 * dentDepth}) 0%,
                rgba(0,0,0,${0.2 * dentDepth}) 35%,
                rgba(0,0,0,${0.08 * dentDepth}) 60%,
                transparent 100%
              )`,
              transition: 'background 0.08s ease-out',
            }}
          />

          {/* 2. Верхний блик края вмятины (свет отражается от верхней кромки) */}
          <div 
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background: `radial-gradient(
                ellipse ${dentRadius * 1.1}% ${dentRadius * 0.35}% at ${mousePos.x}% ${mousePos.y - dentRadius * 0.45}%,
                rgba(255,255,255,${0.7 * dentDepth}) 0%,
                rgba(255,255,255,${0.4 * dentDepth}) 40%,
                rgba(255,255,255,${0.1 * dentDepth}) 70%,
                transparent 100%
              )`,
              transition: 'background 0.08s ease-out',
            }}
          />

          {/* 3. Нижняя тень края (тень от нижней кромки вмятины) */}
          <div 
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background: `radial-gradient(
                ellipse ${dentRadius * 1.0}% ${dentRadius * 0.3}% at ${mousePos.x}% ${mousePos.y + dentRadius * 0.5}%,
                rgba(0,0,0,${0.3 * dentDepth}) 0%,
                rgba(0,0,0,${0.15 * dentDepth}) 50%,
                transparent 100%
              )`,
              transition: 'background 0.08s ease-out',
            }}
          />

          {/* 4. Боковые тени (левая и правая кромки) */}
          <div 
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background: `
                radial-gradient(
                  ellipse ${dentRadius * 0.3}% ${dentRadius * 0.5}% at ${mousePos.x - dentRadius * 0.4}% ${mousePos.y}%,
                  rgba(0,0,0,${0.15 * dentDepth}) 0%,
                  transparent 100%
                ),
                radial-gradient(
                  ellipse ${dentRadius * 0.3}% ${dentRadius * 0.5}% at ${mousePos.x + dentRadius * 0.4}% ${mousePos.y}%,
                  rgba(255,255,255,${0.2 * dentDepth}) 0%,
                  transparent 100%
                )
              `,
              transition: 'background 0.08s ease-out',
            }}
          />

          {/* 5. Внутренний рефлекс (отражённый свет внутри вмятины) */}
          <div 
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background: `radial-gradient(
                ellipse ${dentRadius * 0.5}% ${dentRadius * 0.3}% at ${mousePos.x}% ${mousePos.y + dentRadius * 0.2}%,
                rgba(255,255,255,${0.15 * dentDepth}) 0%,
                transparent 100%
              )`,
              transition: 'background 0.08s ease-out',
            }}
          />

          {/* 6. Кольцевой блик по краю вмятины */}
          <div 
            className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
            style={{
              background: `radial-gradient(
                ellipse ${dentRadius + 5}% ${(dentRadius + 5) * 0.65}% at ${mousePos.x}% ${mousePos.y}%,
                transparent 70%,
                rgba(255,255,255,${0.2 * dentDepth}) 85%,
                rgba(255,255,255,${0.35 * dentDepth}) 92%,
                transparent 100%
              )`,
              transition: 'background 0.08s ease-out',
            }}
          />
        </>
      )}

      {/* Царапины */}
      <div 
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          opacity: 0.12,
          maskImage: 'radial-gradient(ellipse 85% 95% at 50% 50%, transparent 60%, black 95%)',
          WebkitMaskImage: 'radial-gradient(ellipse 85% 95% at 50% 50%, transparent 60%, black 95%)',
          background: `repeating-linear-gradient(
            92deg,
            transparent 0px, transparent 20px,
            rgba(0,0,0,0.4) 20px, rgba(0,0,0,0.4) 20.5px,
            transparent 20.5px, transparent 40px
          )`,
        }}
      />

      {/* Бегущий блик */}
      <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden">
        <div
          className="absolute inset-y-0 w-[30%]"
          style={{
            left: isHovered ? '130%' : '-30%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), rgba(255,255,255,0.7), rgba(255,255,255,0.5), transparent)',
            filter: 'blur(2px)',
            transition: 'left 450ms ease-out',
          }}
        />
      </div>

      {/* Контент */}
      <span 
        className="relative z-10 flex items-center gap-2 text-white"
        style={{
          textShadow: `
            0 1px 2px rgba(0,0,0,0.5),
            0 0 10px rgba(0,0,0,0.3),
            0 0 20px rgba(0,0,0,0.2)
          `,
        }}
      >
        {children}
      </span>

      {/* Индикатор камеры */}
      {hasCamera && (
        <div 
          className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-400 z-20"
          style={{ boxShadow: '0 0 4px rgba(74, 222, 128, 0.8)' }}
        />
      )}
    </button>
  );
}
