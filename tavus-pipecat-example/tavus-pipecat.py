import os
from pathlib import Path

import aiohttp
import yaml
from dotenv import load_dotenv
from loguru import logger

from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.audio.turn.smart_turn.base_smart_turn import SmartTurnParams
from pipecat.audio.turn.smart_turn.local_smart_turn_v3 import LocalSmartTurnAnalyzerV3
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import (
    LLMRunFrame,
    LLMFullResponseStartFrame,
    LLMFullResponseEndFrame,
    OutputTransportMessageUrgentFrame,
    TextFrame,
    TTSStartedFrame,
    TTSStoppedFrame,
    TranscriptionFrame,
    InterimTranscriptionFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.processors.frame_processor import FrameProcessor, FrameDirection
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.services.cartesia.tts import CartesiaTTSService
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.aws.llm import AWSBedrockLLMService
from pipecat.services.tavus.video import TavusVideoService
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.transports.daily.transport import DailyParams

load_dotenv(override=True)

# ---------------------------------------------------------------------------
# Event configuration
# Set EVENT_CONFIG env var to switch events (default: aws-summit-sydney-2026)
# Each event is a directory under prompts/ with its own prompt files + config.yaml
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent
EVENT_CONFIG = os.getenv("EVENT_CONFIG", "aws-summit-sydney-2026")
EVENT_DIR = REPO_ROOT / "prompts" / EVENT_CONFIG

if not EVENT_DIR.exists():
    available = [d.name for d in (REPO_ROOT / "prompts").iterdir() if d.is_dir() and not d.name.startswith("_")]
    raise FileNotFoundError(f"Event config not found: {EVENT_DIR}\nAvailable: {available}")

logger.info(f"Loading event: {EVENT_CONFIG}")

# Load prompt files from the event directory
SYSTEM_PROMPT = (EVENT_DIR / "system-instruction.md").read_text()
CONTEXT_CASCADED = (EVENT_DIR / "context-cascaded.md").read_text()
CONTEXT_NOVA_SONIC = (EVENT_DIR / "context-speech-to-speech.md").read_text()

# Load code-referenced config (greeting, content items)
with open(EVENT_DIR / "config.yaml") as f:
    _config = yaml.safe_load(f)

CUSTOM_GREETING = _config.get("greeting", "Hi, welcome! What is your name?").strip()
CONTENT_ITEMS = _config.get("content_items", {})

# Tool definitions in FunctionSchema format for Pipecat
TOOLS = ToolsSchema(
    standard_tools=[
        FunctionSchema(
            name="show_content",
            description=(
                "Shows content on the main display while moving the video conversation "
                "to a small overlay. Use this when the user asks to see, show, or look "
                "at something — including requests for diagrams, architecture diagrams, "
                "reference architecture, guidance on building voice agents, or the guidance document."
            ),
            properties={
                "item": {
                    "type": "string",
                    "enum": list(CONTENT_ITEMS.keys()),
                    "description": (
                        "The item to display. Options: "
                        + "; ".join(
                            f"{k} = {v.get('label', k)}"
                            + (" (architecture diagram, reference architecture, how to build voice agents on AWS)" if k == "guidance_voice_agents_aws" else "")
                            for k, v in CONTENT_ITEMS.items()
                        )
                    ),
                },
            },
            required=["item"],
        ),
        FunctionSchema(
            name="show_schedule",
            description=(
                "Shows one to three schedule boxes on the main display while moving the "
                "video conversation to a small overlay. Use this when the user asks about "
                "the AWS Summit Sydney schedule, booth sessions, what is happening on a "
                "given day, or which sessions to visit."
            ),
            properties={
                "title": {
                    "type": "string",
                    "description": "Short title for the overall schedule screen.",
                },
                "columns": {
                    "type": "array",
                    "description": "One to three schedule boxes to render side by side.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {
                                "type": "string",
                                "description": "Short title for this box.",
                            },
                            "markdown_table": {
                                "type": "string",
                                "description": "A concise pipe-delimited Markdown table for this box.",
                            },
                        },
                        "required": ["markdown_table"],
                    },
                },
            },
            required=["title", "columns"],
        ),
        FunctionSchema(
            name="dismiss_content",
            description=(
                "Dismisses the currently displayed content and returns the video "
                "conversation to full screen. Use when the user is done looking at "
                "the content or asks to go back."
            ),
            properties={},
            required=[],
        ),
    ]
)

class UserTranscriptForwarder(FrameProcessor):
    """Forwards user STT transcriptions to the frontend via data channel.

    Pushes OutputTransportMessageUrgentFrame downstream so it reaches the
    transport output directly without needing a task reference.
    """

    async def process_frame(self, frame, direction):
        await super().process_frame(frame, direction)

        if isinstance(frame, TranscriptionFrame) and frame.text.strip():
            await self.push_frame(OutputTransportMessageUrgentFrame(
                message={"type": "transcript", "role": "user", "text": frame.text.strip(), "final": True}
            ), FrameDirection.DOWNSTREAM)
        elif isinstance(frame, InterimTranscriptionFrame) and frame.text.strip():
            await self.push_frame(OutputTransportMessageUrgentFrame(
                message={"type": "transcript", "role": "user", "text": frame.text.strip(), "final": False}
            ), FrameDirection.DOWNSTREAM)

        await self.push_frame(frame, direction)


class AgentTranscriptForwarder(FrameProcessor):
    """Forwards agent LLM text to the frontend via data channel.

    For cascaded mode, accumulates word-level TextFrame deltas into a
    growing buffer.  For Nova Sonic, each TextFrame already contains the
    full accumulated text, so we forward it directly without accumulating.
    """

    def __init__(self, accumulate=True, **kwargs):
        super().__init__(**kwargs)
        self._accumulate = accumulate
        self._buffer = ""
        self._sent_speaking = False

    async def process_frame(self, frame, direction):
        await super().process_frame(frame, direction)

        if isinstance(frame, LLMFullResponseStartFrame):
            self._buffer = ""
            self._sent_speaking = False
        elif isinstance(frame, TTSStartedFrame):
            if not self._sent_speaking and not self._buffer.strip():
                await self.push_frame(OutputTransportMessageUrgentFrame(
                    message={"type": "transcript", "role": "agent", "text": "", "final": False}
                ), FrameDirection.DOWNSTREAM)
                self._sent_speaking = True
        elif isinstance(frame, TextFrame):
            if self._accumulate:
                self._buffer += frame.text
                text = self._buffer.strip()
            else:
                text = frame.text.strip()
                self._buffer = text
            if text:
                await self.push_frame(OutputTransportMessageUrgentFrame(
                    message={"type": "transcript", "role": "agent", "text": text, "final": False}
                ), FrameDirection.DOWNSTREAM)
        elif isinstance(frame, LLMFullResponseEndFrame):
            if self._buffer.strip():
                await self.push_frame(OutputTransportMessageUrgentFrame(
                    message={"type": "transcript", "role": "agent", "text": self._buffer.strip(), "final": True}
                ), FrameDirection.DOWNSTREAM)
            self._buffer = ""
            self._sent_speaking = False

        await self.push_frame(frame, direction)


# ---------------------------------------------------------------------------
# Pipeline modes
# ---------------------------------------------------------------------------

PIPELINE_CASCADED = "cascaded"
PIPELINE_NOVA_SONIC = "nova-sonic"

# We store functions so objects (e.g. SileroVADAnalyzer) don't get
# instantiated. The function will be called when the desired transport gets
# selected.
transport_params_cascaded = {
    "daily": lambda: DailyParams(
        audio_in_enabled=True,
        audio_out_enabled=True,
        video_out_enabled=True,
        video_out_is_live=True,
        video_out_width=1280,
        video_out_height=720,
        vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=0.8)),
        turn_analyzer=LocalSmartTurnAnalyzerV3(params=SmartTurnParams()),
    ),
    "webrtc": lambda: TransportParams(
        audio_in_enabled=True,
        audio_out_enabled=True,
        video_out_enabled=True,
        video_out_is_live=True,
        video_out_width=1280,
        video_out_height=720,
        vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=0.8)),
        turn_analyzer=LocalSmartTurnAnalyzerV3(params=SmartTurnParams()),
    ),
}

# Nova Sonic has built-in VAD and turn detection — no external analyzers needed.
transport_params_nova_sonic = {
    "daily": lambda: DailyParams(
        audio_in_enabled=True,
        audio_out_enabled=True,
        video_out_enabled=True,
        video_out_is_live=True,
        video_out_width=1280,
        video_out_height=720,
    ),
    "webrtc": lambda: TransportParams(
        audio_in_enabled=True,
        audio_out_enabled=True,
        video_out_enabled=True,
        video_out_is_live=True,
        video_out_width=1280,
        video_out_height=720,
    ),
}

# Keep the old name for backwards-compat with Pipecat runner
transport_params = transport_params_cascaded


async def run_bot(transport: BaseTransport, runner_args: RunnerArguments, pipeline_mode: str):
    logger.info(f"Starting bot — pipeline: {pipeline_mode}")
    async with aiohttp.ClientSession() as session:
        # Choose Tavus replica based on pipeline mode
        if pipeline_mode == PIPELINE_NOVA_SONIC:
            replica_id = os.getenv("TAVUS_REPLICA_ID_NOVA_SONIC", os.getenv("TAVUS_REPLICA_ID"))
        else:
            replica_id = os.getenv("TAVUS_REPLICA_ID")

        tavus = TavusVideoService(
            api_key=os.getenv("TAVUS_API_KEY"),
            replica_id=replica_id,
            persona_id=os.getenv("TAVUS_PERSONA_ID", "paaee96e4f87"),
            session=session,
        )

        user_transcript = UserTranscriptForwarder()
        agent_transcript = AgentTranscriptForwarder(
            accumulate=(pipeline_mode != PIPELINE_NOVA_SONIC)
        )

        # Assemble system prompt: base instructions + mode-specific architecture context
        arch_context = CONTEXT_NOVA_SONIC if pipeline_mode == PIPELINE_NOVA_SONIC else CONTEXT_CASCADED
        system_prompt = SYSTEM_PROMPT + "\n\n" + arch_context

        # For cascaded mode, add multilingual instruction so the LLM responds
        # in the same language the visitor speaks
        if pipeline_mode == PIPELINE_CASCADED:
            system_prompt += (
                "\n\n## Language\n"
                "If the visitor speaks a language other than English, detect their language "
                "from the transcription and respond in that same language. Keep the same "
                "helpful, enthusiastic persona regardless of language."
            )

        messages = [
            {
                "role": "system",
                "content": system_prompt,
            },
        ]

        context = LLMContext(messages, tools=TOOLS)
        context_aggregator = LLMContextAggregatorPair(context)

        if pipeline_mode == PIPELINE_NOVA_SONIC:
            import boto3
            from pipecat.services.aws.nova_sonic.llm import AWSNovaSonicLLMService

            # Use explicit env vars if set, otherwise fall back to the default
            # credential chain (~/.aws/credentials, IAM role, etc.)
            _ak = os.getenv("AWS_ACCESS_KEY_ID")
            _sk = os.getenv("AWS_SECRET_ACCESS_KEY")
            _st = os.getenv("AWS_SESSION_TOKEN")
            if not _ak or not _sk:
                _aws_creds = boto3.Session().get_credentials().get_frozen_credentials()
                _ak = _aws_creds.access_key
                _sk = _aws_creds.secret_key
                _st = _aws_creds.token

            llm = AWSNovaSonicLLMService(
                access_key_id=_ak,
                secret_access_key=_sk,
                session_token=_st,
                region=os.getenv("AWS_REGION_NOVA_SONIC", "ap-south-1"),
                model="amazon.nova-2-sonic-v1:0",
                voice_id=os.getenv("NOVA_SONIC_VOICE_ID", "matthew"),
                system_instruction=system_prompt,
                tools=TOOLS,
            )

            # Nova Sonic pipeline: audio in → nova_sonic (STT+LLM+TTS) → avatar out
            # Nova Sonic pushes TranscriptionFrame UPSTREAM for user speech.
            # user_transcript must sit between nova_sonic and context_aggregator
            # so it intercepts the upstream frame before the aggregator consumes it.
            pipeline = Pipeline(
                [
                    transport.input(),
                    context_aggregator.user(),
                    user_transcript,
                    llm,
                    agent_transcript,
                    tavus,
                    transport.output(),
                    context_aggregator.assistant(),
                ]
            )
        else:
            # Cascaded pipeline: Deepgram STT → Bedrock Claude → Cartesia TTS
            # Deepgram "multi" auto-detects language; Cartesia auto-detects when
            # language is omitted, enabling multilingual without manual selection.
            stt = DeepgramSTTService(
                api_key=os.getenv("DEEPGRAM_API_KEY"),
                language="multi",
            )
            tts = CartesiaTTSService(
                api_key=os.getenv("CARTESIA_API_KEY"),
                voice_id=os.getenv("CARTESIA_VOICE_ID", "79a125e8-cd45-4c13-8a67-188112f4dd22"),  # British Lady default
            )
            llm = AWSBedrockLLMService(
                model=os.getenv("BEDROCK_MODEL_ID", "apac.anthropic.claude-haiku-4-5-20251001-v1:0"),
                aws_region=os.getenv("BEDROCK_REGION", "ap-south-1"),
            )

            pipeline = Pipeline(
                [
                    transport.input(),
                    stt,
                    user_transcript,
                    context_aggregator.user(),
                    llm,
                    agent_transcript,
                    tts,
                    tavus,
                    transport.output(),
                    context_aggregator.assistant(),
                ]
            )

        task = PipelineTask(
            pipeline,
            params=PipelineParams(
                audio_in_sample_rate=16000,
                audio_out_sample_rate=24000,
                enable_metrics=True,
                enable_usage_metrics=True,
            ),
            idle_timeout_secs=runner_args.pipeline_idle_timeout_secs,
        )

        # Register tool handlers — use OutputTransportMessageUrgentFrame
        # which bypasses the pipeline queue and sends directly via data channel
        async def handle_show_content(params):
            item_key = params.arguments.get("item", "")
            item = CONTENT_ITEMS.get(item_key)
            if item:
                logger.info(f"Tool: show_content -> {item_key}")
                await task.queue_frames([OutputTransportMessageUrgentFrame(
                    message={
                        "type": "tool_call",
                        "tool": "show_content",
                        "data": {"item": item_key, "url": item["url"], "label": item["label"]},
                    }
                )])
                await params.result_callback(f"Showing {item['label']}.")
            else:
                logger.warning(f"Tool: show_content -> unknown item: {item_key}")
                await params.result_callback("I could not find that screen to show.")
            # Nova Sonic: the standard aggregator path defers sending the tool
            # result until BotStoppedSpeakingFrame, which Nova Sonic never emits.
            # Directly send the result to the bidirectional stream and mark it
            # complete so the aggregator path skips it (no double-send).
            if pipeline_mode == PIPELINE_NOVA_SONIC:
                result_text = f"Showing {item['label']}." if item else "I could not find that screen to show."
                await llm._send_tool_result(params.tool_call_id, result_text)
                llm._completed_tool_calls.add(params.tool_call_id)

        async def handle_show_schedule(params):
            title = params.arguments.get("title", "Schedule")
            columns = params.arguments.get("columns", [])
            if columns:
                logger.info(f"Tool: show_schedule -> {title}")
                await task.queue_frames([OutputTransportMessageUrgentFrame(
                    message={
                        "type": "tool_call",
                        "tool": "show_schedule",
                        "data": {"title": title, "columns": columns},
                    }
                )])
                await params.result_callback("Showing the schedule on screen.")
            else:
                await params.result_callback("I could not generate the schedule table for the screen.")
            if pipeline_mode == PIPELINE_NOVA_SONIC:
                result_text = "Showing the schedule on screen." if columns else "I could not generate the schedule table for the screen."
                await llm._send_tool_result(params.tool_call_id, result_text)
                llm._completed_tool_calls.add(params.tool_call_id)

        async def handle_dismiss_content(params):
            logger.info("Tool: dismiss_content")
            await task.queue_frames([OutputTransportMessageUrgentFrame(
                message={
                    "type": "tool_call",
                    "tool": "dismiss_content",
                    "data": {},
                }
            )])
            await params.result_callback("Returning to the full conversation view.")
            if pipeline_mode == PIPELINE_NOVA_SONIC:
                await llm._send_tool_result(params.tool_call_id, "Returning to the full conversation view.")
                llm._completed_tool_calls.add(params.tool_call_id)

        llm.register_function("show_content", handle_show_content)
        llm.register_function("show_schedule", handle_show_schedule)
        llm.register_function("dismiss_content", handle_dismiss_content)

        @transport.event_handler("on_first_participant_joined")
        async def on_first_participant_joined(transport, participant):
            import asyncio
            logger.info(f"First participant joined, waiting for avatar to initialize...")
            await asyncio.sleep(6)
            logger.info(f"Sending greeting")
            messages.append(
                {
                    "role": "system",
                    "content": f"Greet the user with exactly this message: {CUSTOM_GREETING}",
                }
            )
            await task.queue_frames([LLMRunFrame()])

        @transport.event_handler("on_client_disconnected")
        async def on_client_disconnected(transport, client):
            logger.info(f"Client disconnected")
            await task.cancel()

        runner = PipelineRunner(handle_sigint=runner_args.handle_sigint)

        await runner.run(task)


async def bot(runner_args: RunnerArguments):
    """Main bot entry point compatible with Pipecat Cloud."""
    # Read pipeline choice from the offer's requestData
    body = getattr(runner_args, "body", None) or {}
    pipeline_mode = body.get("pipeline", PIPELINE_CASCADED) if isinstance(body, dict) else PIPELINE_CASCADED
    if pipeline_mode not in (PIPELINE_CASCADED, PIPELINE_NOVA_SONIC):
        logger.warning(f"Unknown pipeline mode '{pipeline_mode}', falling back to cascaded")
        pipeline_mode = PIPELINE_CASCADED

    logger.info(f"Pipeline mode from client: {pipeline_mode}")

    # Select transport params based on pipeline mode
    params = transport_params_nova_sonic if pipeline_mode == PIPELINE_NOVA_SONIC else transport_params_cascaded
    transport = await create_transport(runner_args, params)
    await run_bot(transport, runner_args, pipeline_mode)


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
