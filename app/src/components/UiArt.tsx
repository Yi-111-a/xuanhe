// Applies the art agent's UI textures (ui.paper, ui.desk, ui.ink_button …) as CSS custom
// properties + root classes, so every CSS rule can opt in with a procedural fallback.
import { useEffect } from 'react';
import { resolveAsset } from '../api/assets';

const ART: { key: string; ids: string[] }[] = [
  { key: 'paper', ids: ['ui.paper'] },
  { key: 'silk', ids: ['ui.silk'] },
  { key: 'edict', ids: ['ui.edict_paper'] },
  { key: 'desk', ids: ['ui.desk'] },
  { key: 'inkbtn', ids: ['ui.ink_button'] },
  { key: 'lacquer', ids: ['ui.lacquer_bar'] },
  { key: 'seal', ids: ['ui.seal'] },
  { key: 'drum', ids: ['ui.crisis_drum'] },
  { key: 'ribbon-xiang', ids: ['ui.ribbon_xiang'] },
  { key: 'ribbon-yang', ids: ['ui.ribbon_yang'] },
  { key: 'ribbon-fanyang', ids: ['ui.ribbon_fanyang'] },
  { key: 'ribbon-neiting', ids: ['ui.ribbon_neiting'] },
];

/** Crop rectangles as fractions of the source (the edict scroll is painted on a desk). */
const CROPS: Record<string, [number, number, number, number]> = {
  edict: [0, 70 / 1024, 1, 885 / 1024],
};

function crop(url: string, [fx, fy, fw, fh]: [number, number, number, number]): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const sw = img.naturalWidth * fw;
        const sh = img.naturalHeight * fh;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(sw);
        canvas.height = Math.round(sh);
        canvas.getContext('2d')!.drawImage(img, img.naturalWidth * fx, img.naturalHeight * fy, sw, sh, 0, 0, sw, sh);
        canvas.toBlob((b) => resolve(b ? URL.createObjectURL(b) : null), 'image/webp', 0.92);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function useUiArt() {
  useEffect(() => {
    let alive = true;
    const root = document.documentElement;
    for (const a of ART) {
      resolveAsset(a.ids)
        .then((url) => (url && CROPS[a.key] ? crop(url, CROPS[a.key]) : url))
        .then((url) => {
          if (!alive || !url) return;
          root.style.setProperty(`--art-${a.key}`, `url("${url}")`);
          root.classList.add(`art-${a.key}`);
        });
    }
    return () => {
      alive = false;
    };
  }, []);
}
