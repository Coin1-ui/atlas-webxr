declare module "three/examples/jsm/loaders/GLTFLoader.js" {
  export class GLTFLoader {
    parseAsync(data: ArrayBuffer, path: string): Promise<{ scene: { children: unknown[] } }>;
  }
}

declare module "three/examples/jsm/exporters/USDZExporter.js" {
  export type USDZExporterOptions = {
    quickLookCompatible?: boolean;
  };

  export class USDZExporter {
    parseAsync(
      scene: { children: unknown[] },
      options?: USDZExporterOptions
    ): Promise<ArrayBuffer>;
  }
}
