import { useEffect, useState } from 'react';
import { Image } from 'react-native';

// width / height of a remote image, so banners can be sized to their real shape
// instead of being cropped. Clamped to keep extreme images reasonable.
const cache = new Map<string, number>();

export default function useImageRatio(url?: string | null, fallback = 16 / 9, min = 0.8, max = 3.5) {
  const [ratio, setRatio] = useState<number>(() => (url && cache.get(url)) || fallback);

  useEffect(() => {
    if (!url) return;
    const known = cache.get(url);
    if (known) { setRatio(known); return; }
    let alive = true;
    Image.getSize(url, (w, h) => {
      if (!(w > 0 && h > 0)) return;
      const r = Math.min(max, Math.max(min, w / h));
      cache.set(url, r);
      if (alive) setRatio(r);
    }, () => {});
    return () => { alive = false; };
  }, [url, min, max]);

  return ratio;
}
