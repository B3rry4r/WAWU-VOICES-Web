/* Logo files. They are copied to web/public/vx/ (see README.md); change the
   base with setVxAssetBase() if the app serves them from a CDN. */
export interface VxAssets {
  wordmark: string;
  wordmarkWhite: string;
  mark: string;
  markWhite: string;
}

let base = '/vx';

function build(b: string): VxAssets {
  return {
    wordmark: b + '/logo-wordmark-green.png',
    wordmarkWhite: b + '/logo-wordmark-white.png',
    mark: b + '/logo-icon-green.png',
    markWhite: b + '/logo-icon-white.png',
  };
}

export const ASSETS: VxAssets = build(base);

export function setVxAssetBase(next: string): void {
  base = next.replace(/\/$/, '');
  Object.assign(ASSETS, build(base));
}
