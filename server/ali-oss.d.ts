declare module 'ali-oss' {
  interface ClientOptions { region: string; bucket: string; accessKeyId: string; accessKeySecret: string; endpoint?: string; secure?: boolean; timeout?: number; stsToken?: string; refreshSTSToken?: () => Promise<{ accessKeyId: string; accessKeySecret: string; stsToken: string }>; refreshSTSTokenInterval?: number; }
  interface PutOptions { headers?: Record<string, string>; }
  interface GetResult { content: Buffer | Uint8Array; res: { headers: Record<string, string | undefined> }; }
  class OSS {
    constructor(options: ClientOptions);
    put(name: string, content: Buffer, options?: PutOptions): Promise<unknown>;
    get(name: string): Promise<GetResult>;
    delete(name: string): Promise<unknown>;
  }
  export default OSS;
}
