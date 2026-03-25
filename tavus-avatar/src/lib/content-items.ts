export const CONTENT_ITEMS = {
  aws_voice_ai_overview: {
    url: "/content/aws-voice-ai",
    label: "AWS Voice AI Overview",
  },
  guidance_voice_agents_aws: {
    url: "/content/guidance-voice-agents-aws",
    label: "Guidance for Voice Agents on AWS",
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
  guidance_voice_agents_aws: [
    "guidance_voice_agents_aws",
    "guidance for voice agents",
    "guidance for voice agents on aws",
    "voice agents guidance",
    "voice agent guidance aws",
    "aws guidance",
    "aws voice agent guidance",
    "sample voice agent",
    "architecture diagram",
    "reference architecture",
    "diagram",
    "the diagram",
    "show diagram",
    "voice agent architecture",
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
