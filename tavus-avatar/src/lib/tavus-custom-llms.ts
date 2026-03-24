export type CustomTavusLlmConfig = {
  disableVideo?: boolean;
  layers: {
    llm: Record<string, unknown>;
  };
};

export const CUSTOM_TAVUS_LLM_CONFIGS: Record<string, CustomTavusLlmConfig> = {};

export function getCustomTavusLlmConfig(name: string): CustomTavusLlmConfig | null {
  return Object.prototype.hasOwnProperty.call(CUSTOM_TAVUS_LLM_CONFIGS, name)
    ? CUSTOM_TAVUS_LLM_CONFIGS[name]
    : null;
}
