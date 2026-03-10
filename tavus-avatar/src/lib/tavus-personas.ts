import "server-only";

import { getCustomTavusLlmConfig } from "@/lib/tavus-custom-llms";
import { getTavusErrorMessage, readResponsePayload, tavusFetch } from "@/lib/tavus-api";

type TavusPersonaLayers = Record<string, unknown> & {
  llm?: Record<string, unknown>;
};

type TavusPersona = {
  context?: string;
  default_replica_id?: string;
  document_ids?: string[];
  document_tags?: string[];
  layers?: TavusPersonaLayers;
  persona_id: string;
  persona_name?: string;
  pipeline_mode?: string;
  system_prompt?: string;
};

type TavusPersonaCollectionResponse = {
  data?: TavusPersona[];
};

type TavusPersonaCreateResponse = {
  persona_id: string;
  persona_name?: string;
};

declare global {
  var __tavusDerivedPersonaCache__: Map<string, string> | undefined;
}

function getDerivedPersonaCache() {
  if (!globalThis.__tavusDerivedPersonaCache__) {
    globalThis.__tavusDerivedPersonaCache__ = new Map<string, string>();
  }

  return globalThis.__tavusDerivedPersonaCache__;
}

function getDerivedPersonaName(basePersona: TavusPersona, llmName: string) {
  const baseName = basePersona.persona_name?.trim() || basePersona.persona_id;
  return `${baseName} (${llmName})`;
}

async function getPersona(personaId: string) {
  const response = await tavusFetch(`/personas/${personaId}`);
  const payload = await readResponsePayload<TavusPersona | { error?: string; message?: string }>(
    response,
  );

  if (!response.ok || !payload.json || !("persona_id" in payload.json)) {
    throw new Error(getTavusErrorMessage(response, payload.json, "Failed to load Tavus persona."));
  }

  return payload.json;
}

async function findPersonaByName(personaName: string) {
  const response = await tavusFetch("/personas");
  const payload = await readResponsePayload<TavusPersonaCollectionResponse | { error?: string; message?: string }>(
    response,
  );

  if (!response.ok || !payload.json || !("data" in payload.json) || !Array.isArray(payload.json.data)) {
    throw new Error(getTavusErrorMessage(response, payload.json, "Failed to list Tavus personas."));
  }

  return payload.json.data.find((persona) => persona.persona_name === personaName) ?? null;
}

async function createDerivedPersona(basePersona: TavusPersona, llmName: string) {
  const llmConfig = getCustomTavusLlmConfig(llmName);

  if (!llmConfig) {
    throw new Error(`Unknown Tavus LLM configuration "${llmName}".`);
  }

  if (!basePersona.system_prompt) {
    throw new Error("The base Tavus persona is missing a system prompt and cannot be cloned.");
  }

  const personaName = getDerivedPersonaName(basePersona, llmName);
  const mergedLayers: TavusPersonaLayers = {
    ...(basePersona.layers ?? {}),
    llm: {
      ...(basePersona.layers?.llm ?? {}),
      ...llmConfig.layers.llm,
    },
  };

  const createBody: Record<string, unknown> = {
    persona_name: personaName,
    pipeline_mode: basePersona.pipeline_mode ?? "full",
    system_prompt: basePersona.system_prompt,
    layers: mergedLayers,
  };

  if (basePersona.context) {
    createBody.context = basePersona.context;
  }

  if (basePersona.default_replica_id) {
    createBody.default_replica_id = basePersona.default_replica_id;
  }

  if (basePersona.document_ids?.length) {
    createBody.document_ids = basePersona.document_ids;
  }

  if (basePersona.document_tags?.length) {
    createBody.document_tags = basePersona.document_tags;
  }

  const response = await tavusFetch("/personas", {
    method: "POST",
    body: JSON.stringify(createBody),
  });

  const payload = await readResponsePayload<TavusPersonaCreateResponse | { error?: string; message?: string }>(
    response,
  );

  if (!response.ok || !payload.json || !("persona_id" in payload.json)) {
    throw new Error(getTavusErrorMessage(response, payload.json, "Failed to create Tavus persona."));
  }

  return payload.json.persona_id;
}

export async function resolveConversationPersonaId(basePersonaId: string, llmName?: string | null) {
  if (!llmName) {
    return basePersonaId;
  }

  const llmConfig = getCustomTavusLlmConfig(llmName);

  if (!llmConfig) {
    throw new Error(`Unknown Tavus LLM configuration "${llmName}".`);
  }

  const cacheKey = `${basePersonaId}:${llmName}`;
  const derivedPersonaCache = getDerivedPersonaCache();
  const cachedPersonaId = derivedPersonaCache.get(cacheKey);

  if (cachedPersonaId) {
    return cachedPersonaId;
  }

  const basePersona = await getPersona(basePersonaId);
  const derivedPersonaName = getDerivedPersonaName(basePersona, llmName);
  const existingPersona = await findPersonaByName(derivedPersonaName);

  if (existingPersona?.persona_id) {
    derivedPersonaCache.set(cacheKey, existingPersona.persona_id);
    return existingPersona.persona_id;
  }

  const derivedPersonaId = await createDerivedPersona(basePersona, llmName);
  derivedPersonaCache.set(cacheKey, derivedPersonaId);

  return derivedPersonaId;
}
