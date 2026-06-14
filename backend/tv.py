import asyncio
import json
from pathlib import Path
from typing import Optional

CONFIG_FILE = Path(__file__).parent / "tv_config.json"


def _load() -> dict:
    return json.loads(CONFIG_FILE.read_text()) if CONFIG_FILE.exists() else {}


def _save(data: dict):
    CONFIG_FILE.write_text(json.dumps(data, indent=2))


def get_settings() -> dict:
    cfg = _load()
    return {"host": cfg.get("host", ""), "mac": cfg.get("mac", ""), "paired": bool(cfg.get("client_key"))}


def update_settings(host: str, mac: str):
    cfg = _load()
    if cfg.get("host") != host.strip():
        cfg.pop("client_key", None)
    cfg["host"] = host.strip()
    if mac.strip():
        cfg["mac"] = mac.strip()
    _save(cfg)


async def pair(host: str) -> bool:
    from aiowebostv import WebOsClient
    client = WebOsClient(host)
    await asyncio.wait_for(client.connect(), timeout=30)
    key = client.client_key
    cfg = _load()
    cfg.update({"host": host, "client_key": key})
    _save(cfg)
    await client.disconnect()
    return bool(key)


async def _connected_client() -> "WebOsClient":  # noqa: F821
    from aiowebostv import WebOsClient
    cfg = _load()
    host = cfg.get("host")
    if not host:
        raise ValueError("TV IP not configured")
    client = WebOsClient(host, client_key=cfg.get("client_key"))
    await asyncio.wait_for(client.connect(), timeout=10)
    return client


async def send_command(action: str, **kwargs):
    client = await _connected_client()
    try:
        await _dispatch(client, action, **kwargs)
    finally:
        await client.disconnect()


async def _dispatch(client, action: str, **kwargs):
    if action == "power_on":
        mac = _load().get("mac")
        if not mac:
            raise ValueError("MAC address not set — needed for Wake-on-LAN power on")
        import wakeonlan
        wakeonlan.send_magic_packet(mac)
    elif action == "power_off":
        await client.power_off()
    elif action == "volume_up":
        await client.volume_up()
    elif action == "volume_down":
        await client.volume_down()
    elif action == "mute":
        vol = await client.get_volume()
        await client.set_mute(not vol.get("muted", False))
    elif action == "channel_up":
        await client.channel_up()
    elif action == "channel_down":
        await client.channel_down()
    elif action == "play":
        await client.play()
    elif action == "pause":
        await client.pause()
    elif action == "stop":
        await client.stop()
    elif action == "rewind":
        await client.rewind()
    elif action == "fast_forward":
        await client.fast_forward()
    elif action == "home":
        await client.button("HOME")
    elif action == "button":
        await client.button(kwargs["name"].upper())
    elif action == "launch_app":
        app_id = kwargs.get("app_id")
        if not app_id:
            raise ValueError("app_id is required for launch_app")
        await client.launch_app(app_id)
    elif action == "set_input":
        await client.set_input(kwargs["input_id"])
    else:
        raise ValueError(f"Unknown TV action: {action}")


async def get_apps() -> list:
    client = await _connected_client()
    try:
        apps = await client.get_apps()
        return [{"id": a["id"], "title": a.get("title", a["id"])} for a in apps]
    finally:
        await client.disconnect()


async def get_inputs() -> list:
    client = await _connected_client()
    try:
        return await client.get_inputs()
    finally:
        await client.disconnect()
