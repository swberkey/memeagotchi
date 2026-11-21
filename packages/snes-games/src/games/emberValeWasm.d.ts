export interface EmberValeModuleArgs {
  saveWrite: (name: string, data: Uint8Array) => number;
  saveRead: (name: string) => Uint8Array | null;
}

export interface EmberValeWasmModule {
  HEAPU8: Uint8Array;
  HEAPU32: Uint32Array;
  _web_init(): void;
  _web_step(buttons: number): number;
  _web_render(): number;
  _web_save(): void;
  _web_coins(): number;
}

declare function EmberValeFactory(moduleArg?: EmberValeModuleArgs): Promise<EmberValeWasmModule>;

export default EmberValeFactory;
