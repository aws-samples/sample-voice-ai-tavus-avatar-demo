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
  conversation_id: string;
  properties?: Record<string, unknown>;
}

export interface TavusConversationEventMessage {
  message_type: "conversation";
  event_type: string;
  conversation_id: string;
  inference_id?: string;
  properties?: Record<string, unknown>;
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
  | TavusConversationEchoMessage
  | TavusSystemMessage
  | TavusConversationEventMessage;
