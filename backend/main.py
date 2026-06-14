import asyncio
import sys
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from remote import VALID_COMMANDS, execute_command
from voice import text_to_command, transcribe
import tv as lg

FRONTEND = Path(__file__).parent.parent / "frontend"

app = FastAPI(title="Media Remote")


@app.post("/api/command/{action}")
async def send_command(action: str):
    if action not in VALID_COMMANDS:
        raise HTTPException(status_code=400, detail=f"Unknown command: {action}")
    execute_command(action)
    return {"status": "ok", "action": action}


@app.post("/api/voice/transcribe")
async def voice_transcribe(audio: UploadFile = File(...)):
    try:
        audio_bytes = await audio.read()
        text = transcribe(audio_bytes)
        command = text_to_command(text)
        if command:
            execute_command(command)
        return {"text": text, "command": command}
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="openai-whisper not installed. Run: pip install openai-whisper",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── TV (LG webOS) routes ────────────────────────────────────────────────────

class TvSettings(BaseModel):
    host: str
    mac: str = ""


@app.get("/api/tv/config")
async def tv_config():
    return lg.get_settings()


@app.post("/api/tv/settings")
async def tv_save_settings(s: TvSettings):
    lg.update_settings(s.host, s.mac)
    return {"status": "ok"}


@app.post("/api/tv/pair")
async def tv_pair(s: TvSettings):
    lg.update_settings(s.host, s.mac)
    try:
        paired = await lg.pair(s.host)
        return {"status": "ok", "paired": paired}
    except asyncio.TimeoutError:
        raise HTTPException(408, "Pairing timeout — accept the prompt on your TV")
    except Exception as exc:
        raise HTTPException(500, str(exc))


@app.post("/api/tv/command/{action}")
async def tv_command(action: str, input_id: Optional[str] = None, app_id: Optional[str] = None, name: Optional[str] = None):
    try:
        kwargs = {}
        if input_id: kwargs["input_id"] = input_id
        if app_id:   kwargs["app_id"] = app_id
        if name:     kwargs["name"] = name
        await lg.send_command(action, **kwargs)
        return {"status": "ok", "action": action}
    except asyncio.TimeoutError:
        raise HTTPException(408, "TV connection timed out — is the TV on and on the same network?")
    except Exception as exc:
        raise HTTPException(500, str(exc))


@app.get("/api/tv/apps")
async def tv_apps():
    try:
        return {"apps": await lg.get_apps()}
    except asyncio.TimeoutError:
        raise HTTPException(408, "TV connection timed out")
    except Exception as exc:
        raise HTTPException(500, str(exc))


@app.get("/api/tv/inputs")
async def tv_inputs():
    try:
        return {"inputs": await lg.get_inputs()}
    except asyncio.TimeoutError:
        raise HTTPException(408, "TV connection timed out")
    except Exception as exc:
        raise HTTPException(500, str(exc))


# ── Frontend ─────────────────────────────────────────────────────────────────

@app.get("/")
async def index():
    return FileResponse(str(FRONTEND / "index.html"))


app.mount("/", StaticFiles(directory=str(FRONTEND), html=True), name="frontend")
