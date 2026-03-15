import Hls from 'hls.js';

export interface HlsPlayerOptions {
  onError?: (type: string, fatal: boolean) => void;
  onLevelLoaded?: (quality: string) => void;
  referrer?: string;
  userAgent?: string;
}

export function createHlsPlayer(
  videoEl: HTMLVideoElement,
  url: string,
  options: HlsPlayerOptions = {}
): Hls | null {
  if (Hls.isSupported()) {
    let networkRetries = 0;
    const MAX_NETWORK_RETRIES = 3;

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 90,
      // Be more lenient with retries before giving up
      fragLoadingMaxRetry: 4,
      manifestLoadingMaxRetry: 4,
      levelLoadingMaxRetry: 4,
      xhrSetup: (xhr, reqUrl) => {
        // Note: Referer header cannot be set in browsers for cross-origin requests
        // This only works for same-origin or when CORS allows it
      },
    });

    hls.loadSource(url);
    hls.attachMedia(videoEl);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      videoEl.play().catch(() => {
        // Autoplay may be blocked — user interaction required
      });
    });

    hls.on(Hls.Events.LEVEL_LOADED, (_, data) => {
      const level = hls.levels[hls.currentLevel];
      if (level && options.onLevelLoaded) {
        const height = level.height;
        const quality =
          height >= 1080 ? '1080p' :
          height >= 720 ? '720p' :
          height >= 480 ? '480p' :
          height > 0 ? `${height}p` : 'Live';
        options.onLevelLoaded(quality);
      }
      // Reset retry counter on successful load
      networkRetries = 0;
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            networkRetries++;
            if (networkRetries <= MAX_NETWORK_RETRIES) {
              // Try to recover by restarting the load
              console.log(`[HLS] Network error, retry ${networkRetries}/${MAX_NETWORK_RETRIES}`);
              setTimeout(() => hls.startLoad(), 1000 * networkRetries);
            } else {
              // All retries exhausted — signal parent to try next stream
              console.log('[HLS] Network retries exhausted, signaling fatal error');
              options.onError?.(data.type, true);
            }
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log('[HLS] Media error, attempting recovery');
            hls.recoverMediaError();
            break;
          default:
            // Unrecoverable error — signal parent
            console.log('[HLS] Unrecoverable error:', data.details);
            options.onError?.(data.type, true);
            hls.destroy();
            break;
        }
      }
      // Non-fatal errors: ignore (HLS.js handles them internally)
    });

    return hls;
  } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari native HLS
    videoEl.src = url;
    videoEl.addEventListener('error', () => {
      options.onError?.('NATIVE_ERROR', true);
    }, { once: true });
    videoEl.play().catch(() => {});
    return null;
  } else {
    options.onError?.('UNSUPPORTED', true);
    return null;
  }
}
