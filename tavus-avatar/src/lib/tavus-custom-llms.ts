export const CUSTOM_TAVUS_LLM_CONFIGS = {
  // Modal endpoint for the super-4 Nemotron serving stack. This endpoint is text-only, so we disable camera input.
  "super-4-modal": {
    disableVideo: true,
    layers: {
      llm: {
        model: "nemotron-3-super-120b",
        base_url: "https://daily--nemotron-super-b200-ea-vllm-serve-nvfp475.modal.run/v1",
        api_key: "dummy",
        speculative_inference: false,
        extra_body: {
          temperature: 0.6,
          top_p: 0.95,
          frequency_penalty: 0.0,
          chat_template_kwargs: {
            enable_thinking: false,
          },
        },
      },
    },
  },
} as const;

export type CustomTavusLlmName = keyof typeof CUSTOM_TAVUS_LLM_CONFIGS;

export function getCustomTavusLlmConfig(name: string) {
  return Object.prototype.hasOwnProperty.call(CUSTOM_TAVUS_LLM_CONFIGS, name)
    ? CUSTOM_TAVUS_LLM_CONFIGS[name as CustomTavusLlmName]
    : null;
}
