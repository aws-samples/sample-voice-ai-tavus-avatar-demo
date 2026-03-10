export const CONTENT_ITEMS = {
  aws_voice_ai_overview: {
    url: "/content/aws-voice-ai",
    label: "AWS Voice AI Overview",
  },
  daniel_voice_ai_architecture_diagram: {
    url: "/content/daniel-voice-ai-architecture-diagram",
    label: "Daniel's Voice AI Architecture Diagram",
  },
} as const;

export type ContentItemKey = keyof typeof CONTENT_ITEMS;
export const DEFAULT_CONTENT_ITEM_KEY: ContentItemKey = "aws_voice_ai_overview";

const CONTENT_ITEM_ALIASES: Record<ContentItemKey, string[]> = {
  aws_voice_ai_overview: [
    "aws_voice_ai_overview",
    "aws voice ai overview",
    "aws ai overview",
    "aws overview",
    "voice ai overview",
    "aws voice overview",
  ],
  daniel_voice_ai_architecture_diagram: [
    "daniel_voice_ai_architecture_diagram",
    "daniel voice ai architecture diagram",
    "daniel architecture diagram",
    "daniel s voice ai architecture diagram",
    "voice ai architecture diagram",
    "reference architecture",
    "pipecat architecture diagram",
    "architecture diagram",
  ],
};

function normalizeContentKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isContentItemKey(value: string): value is ContentItemKey {
  return Object.prototype.hasOwnProperty.call(CONTENT_ITEMS, value);
}

export function resolveContentItemKey(value?: unknown): ContentItemKey | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    if (Object.keys(CONTENT_ITEMS).length === 1) {
      return DEFAULT_CONTENT_ITEM_KEY;
    }

    return null;
  }

  if (isContentItemKey(value)) {
    return value;
  }

  const normalizedValue = normalizeContentKey(value);

  const matchedEntry = (Object.entries(CONTENT_ITEM_ALIASES) as Array<
    [ContentItemKey, string[]]
  >).find(([, aliases]) =>
    aliases.some((alias) => {
      const normalizedAlias = normalizeContentKey(alias);
      return (
        normalizedAlias === normalizedValue ||
        normalizedAlias.includes(normalizedValue) ||
        normalizedValue.includes(normalizedAlias)
      );
    }),
  );

  if (matchedEntry) {
    return matchedEntry[0];
  }

  if (Object.keys(CONTENT_ITEMS).length === 1) {
    return DEFAULT_CONTENT_ITEM_KEY;
  }

  return null;
}
