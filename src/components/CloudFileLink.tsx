import React, { useEffect, useState } from 'react';
import { getCloudDownloadUrl, resolveUploadUrl } from '../utils/storageSync.js';

export function useResolvedUploadUrl(filename?: string | null): string {
  const initial = filename ? `/uploads/${encodeURIComponent(filename)}` : '';
  const [resolvedUrl, setResolvedUrl] = useState<string>(initial);

  useEffect(() => {
    let active = true;
    if (!filename) {
      setResolvedUrl('');
      return;
    }
    setResolvedUrl(`/uploads/${encodeURIComponent(filename)}`);
    resolveUploadUrl(filename).then((url) => {
      if (active && url) setResolvedUrl(url);
    });
    return () => {
      active = false;
    };
  }, [filename]);

  return resolvedUrl;
}

interface CloudFileAnchorProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  filename: string;
  children: React.ReactNode;
}

export const CloudFileAnchor: React.FC<CloudFileAnchorProps> = ({
  filename,
  children,
  onClick,
  ...rest
}) => {
  const href = useResolvedUploadUrl(filename);
  return (
    <a
      {...rest}
      href={href || `/uploads/${encodeURIComponent(filename)}`}
      onClick={onClick}
    >
      {children}
    </a>
  );
};

interface CloudMediaImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  filename: string;
}

export const CloudMediaImg: React.FC<CloudMediaImgProps> = ({
  filename,
  onError,
  ...rest
}) => {
  const src = useResolvedUploadUrl(filename);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  useEffect(() => {
    setFallbackUrl(null);
  }, [filename]);

  return (
    <img
      {...rest}
      src={fallbackUrl || src}
      onError={async (e) => {
        if (!fallbackUrl) {
          const cloudUrl = await getCloudDownloadUrl(filename);
          if (cloudUrl) {
            setFallbackUrl(cloudUrl);
            return;
          }
        }
        onError?.(e);
      }}
    />
  );
};
