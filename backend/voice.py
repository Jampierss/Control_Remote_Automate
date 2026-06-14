import os
import tempfile
from typing import Optional

_whisper_model = None

# Ordered longest-first so "volume up" matches before "up"
_VOICE_MAP: list[tuple[str, str]] = [
    ("play pause", "play_pause"),
    ("volume up", "volume_up"),
    ("volume down", "volume_down"),
    ("full screen", "fullscreen"),
    ("fullscreen", "fullscreen"),
    ("play", "play_pause"),
    ("pause", "play_pause"),
    ("next", "next"),
    ("skip", "next"),
    ("previous", "previous"),
    ("rewind", "backward"),
    ("forward", "forward"),
    ("louder", "volume_up"),
    ("quieter", "volume_down"),
    ("softer", "volume_down"),
    ("mute", "mute"),
    ("unmute", "mute"),
    ("silence", "mute"),
]


def text_to_command(text: str) -> Optional[str]:
    lower = text.lower().strip()
    for phrase, command in _VOICE_MAP:
        if phrase in lower:
            return command
    return None


def transcribe(audio_bytes: bytes) -> str:
    global _whisper_model
    try:
        import whisper
    except ImportError as exc:
        raise ImportError("openai-whisper not installed") from exc

    if _whisper_model is None:
        _whisper_model = whisper.load_model("base")

    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
        f.write(audio_bytes)
        tmp_path = f.name
    try:
        result = _whisper_model.transcribe(tmp_path)
        return result["text"].strip()
    finally:
        os.unlink(tmp_path)
