export interface TavusConversationCreateResponse {
  conversation_id: string;
  conversation_url: string;
  conversation_name?: string;
  created_at?: string;
  persona_id?: string;
  replica_id?: string;
  status?: string;
}

export interface TavusConversationEchoMessage {
  message_type: "conversation";
  event_type: "conversation.echo";
  conversation_id: string;
  properties: {
    inference_id?: string;
    modality: "text";
    text: string;
    done: true;
  };
}

export interface TavusSystemMessage {
  message_type: "system";
  event_type: string;
  conversation_id?: string;
  properties?: Record<string, unknown>;
}

export interface TavusConversationEventMessage {
  message_type: "conversation";
  event_type: string;
  conversation_id?: string;
  inference_id?: string;
  properties?: Record<string, unknown>;
}

export type TavusConversationRole = "user" | "replica";

export interface TavusConversationUtteranceMessage {
  message_type: "conversation";
  event_type: "conversation.utterance";
  conversation_id?: string;
  inference_id?: string;
  properties: {
    speech: string;
    role: TavusConversationRole;
    user_audio_analysis?: string;
    user_visual_analysis?: string;
  };
}

export interface TavusConversationSpeakingStateMessage {
  message_type: "conversation";
  event_type:
    | "conversation.user.started_speaking"
    | "conversation.user.stopped_speaking"
    | "conversation.replica.started_speaking"
    | "conversation.replica.stopped_speaking"
    | "conversation.replica_interrupted";
  conversation_id?: string;
  inference_id?: string;
  properties?: {
    duration?: number | null;
    inference_id?: string;
  };
}

export interface TavusToolCallMessage {
  message_type: "conversation";
  event_type: "conversation.tool_call";
  conversation_id: string;
  inference_id?: string;
  properties: {
    name: string;
    arguments: string | Record<string, unknown>;
  };
}

export type TavusAppMessage =
  | TavusToolCallMessage
  | TavusConversationUtteranceMessage
  | TavusConversationSpeakingStateMessage
  | TavusConversationEchoMessage
  | TavusSystemMessage
  | TavusConversationEventMessage;
