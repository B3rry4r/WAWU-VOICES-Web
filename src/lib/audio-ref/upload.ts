import { baseMime } from './mime';

export interface PresignedPut { url: string; key: string; headers: Record<string, string> }

/** PUT the raw recording to the presigned Spaces URL, with retry and progress. fetch has no upload progress, so XHR is used. */
export function putWithRetry(p: PresignedPut, blob: Blob, onProgress?: (frac: number) => void, tries = 3): Promise<void> {
  const attempt = (n: number): Promise<void> => new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('PUT', p.url);
    x.setRequestHeader('Content-Type', baseMime(blob.type));
    x.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : retry(new Error('put ' + x.status)));
    x.onerror = () => retry(new Error('network'));
    const retry = (err: Error) => (n + 1 < tries ? setTimeout(() => attempt(n + 1).then(resolve, reject), 600 * 2 ** n) : reject(err));
    x.send(blob);
  });
  return attempt(0);
}
