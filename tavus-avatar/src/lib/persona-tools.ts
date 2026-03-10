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
                  "guidance_voice_agents_aws",
                  "guidance_voice_agents_nvidia",
                ],
                description:
                  "The item to display. Options: aws_voice_ai_overview = local AWS voice AI overview page; daniel_voice_ai_architecture_diagram = Daniel's voice AI architecture diagram image; guidance_voice_agents_aws = Guidance for Voice Agents on AWS reference architecture; guidance_voice_agents_nvidia = Guidance for Voice Agents on AWS with NVIDIA reference architecture",
              },
            },
            required: ["item"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "show_schedule",
          description:
            "Shows one to three schedule boxes on the main display while moving the video conversation to a small overlay. Use this when the user asks about the AWS at GTC schedule, booth demos, kiosk locations, theater sessions, what is happening on a given day, or which related demos to visit. First consult the schedule knowledge base, then decide whether the answer fits best as 1, 2, or 3 boxes. Each box should contain a concise pipe-delimited Markdown table. Aim for 8 body rows or fewer per box, but you may use up to 11 body rows when needed to show a full day's scheduled demos in one box. If the content would be taller than that, split it across multiple boxes with clear titles such as Monday, Tuesday, Wednesday, Scheduled Demos, or Drop-in Demos.",
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description:
                  "Short title for the overall schedule screen, such as Thursday Booth Demos or Voice AI Related Demos.",
              },
              columns: {
                type: "array",
                minItems: 1,
                maxItems: 3,
                description:
                  "One to three schedule boxes to render side by side. Split the answer into multiple boxes when that makes the schedule easier to fit and read.",
                items: {
                  type: "object",
                  properties: {
                    title: {
                      type: "string",
                      description:
                        "Short title for this box, such as Monday, Tuesday, Scheduled Demos, Drop-in Demos, Theater Sessions, or Kiosk 3.",
                    },
                    markdown_table: {
                      type: "string",
                      description:
                        "A concise pipe-delimited Markdown table for this box. Aim for 8 body rows or fewer, with an absolute maximum of 11 body rows.",
                    },
                  },
                  required: ["markdown_table"],
                },
              },
            },
            required: ["title", "columns"],
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
