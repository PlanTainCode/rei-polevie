import { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';

interface AuthImageProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
  loading?: 'lazy' | 'eager';
}

/**
 * Компонент для отображения изображений с авторизацией
 * Загружает изображение через fetch с JWT токеном
 */
export function AuthImage({ src, alt, className, onClick, loading = 'lazy' }: AuthImageProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    
    const loadImage = async () => {
      try {
        const response = await apiClient.get(src, {
          responseType: 'blob',
        });
        
        if (cancelled) return;
        
        const blob = new Blob([response.data], { type: response.headers['content-type'] || 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        setImageSrc(url);
        setError(false);
      } catch (err) {
        if (cancelled) return;
        console.error('Error loading image:', err);
        setError(true);
      }
    };

    loadImage();

    return () => {
      cancelled = true;
      if (imageSrc) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [src]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] ${className}`}>
        <span className="text-sm">Ошибка загрузки</span>
      </div>
    );
  }

  if (!imageSrc) {
    return (
      <div className={`flex items-center justify-center bg-[var(--bg-tertiary)] ${className}`}>
        <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      onClick={onClick}
      loading={loading}
    />
  );
}
