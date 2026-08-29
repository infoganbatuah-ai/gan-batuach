declare module "hls.js" {
  type HlsErrorData = {
    fatal?: boolean;
  };

  type HlsConfig = {
    liveSyncDurationCount?: number;
    liveMaxLatencyDurationCount?: number;
    enableWorker?: boolean;
    lowLatencyMode?: boolean;
  };

  export default class Hls {
    static Events: {
      ERROR: string;
      MEDIA_ATTACHED: string;
      MANIFEST_PARSED: string;
    };
    static isSupported(): boolean;
    constructor(config?: HlsConfig);
    loadSource(source: string): void;
    attachMedia(media: HTMLMediaElement): void;
    on(event: string, callback: (event: string, data: HlsErrorData) => void): void;
    destroy(): void;
  }
}
