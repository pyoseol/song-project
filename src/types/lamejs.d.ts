declare module "lamejs" {
  export class Mp3Encoder {
    constructor(channels: number, sampleRate: number, kbps: number);
    encodeBuffer(
      left: Int16Array,
      right?: Int16Array
    ): Int8Array | Uint8Array | number[];
    flush(): Int8Array | Uint8Array | number[];
  }
  const lamejs: {
    Mp3Encoder: typeof Mp3Encoder;
  };
  export default lamejs;
}

declare global {
  interface Window {
    lamejs?: {
      Mp3Encoder?: new (
        channels: number,
        sampleRate: number,
        kbps: number
      ) => unknown;
    };
  }
}
