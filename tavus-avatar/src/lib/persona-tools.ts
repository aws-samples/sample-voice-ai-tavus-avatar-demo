export const PERSONA_TOOL_PATCH = [
  {
    op: "replace",
    path: "/layers/llm/tools",
    value: [
      {
        type: "function",
        function: {
          name: "show_content",
          description:
            "Shows content on the main display while moving the video conversation to a small overlay. Use this when the user asks to see, show, or look at something.",
          parameters: {
            type: "object",
            properties: {
              item: {
                type: "string",
                enum: [
                  "aws_voice_ai_overview",
                  "daniel_voice_ai_architecture_diagram",
                ],
                description:
                  "The item to display. Options: aws_voice_ai_overview = local AWS voice AI overview page; daniel_voice_ai_architecture_diagram = Daniel's voice AI architecture diagram image",
              },
            },
            required: ["item"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "dismiss_content",
          description:
            "Dismisses the currently displayed content and returns the video conversation to full screen. Use when the user is done looking at the content or asks to go back.",
          parameters: {
            type: "object",
            properties: {},
          },
        },
      },
    ],
  },
] as const;
