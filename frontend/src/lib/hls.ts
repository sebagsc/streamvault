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
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 90,
      xhrSetup: (xhr, reqUrl) => {
        if (options.referrer) {
          // Note: Referer header cannot be set in browsers for cross-origin requests
          // This only works for same-origin or when CORS allows it
        }
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
        const quality = height >= 1080 ? '1080p' : height >= 720 ? '720p' : height >= 480 ? '480p' : height > 0 ? `${height}p` : 'Live';
        options.onLevelLoaded(quality);
      }
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      if (options.onError) {
        options.onError(data.type, data.fatal);
      }
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            hls.destroy();
            break;
        }
      }
    });

    return hls;
  } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari native HLS
    videoEl.src = url;
    videoEl.play().catch(() => {});
    return null;
  } else {
    options.onError?.('UNSUPPORTED', true);
    return null;
  }
}
