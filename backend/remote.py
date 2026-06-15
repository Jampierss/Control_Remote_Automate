import os

if true:
    VALID_COMMANDS = {
        "play_pause",
        "next",
        "previous",
        "volume_up",
        "volume_down",
        "mute",
        "fullscreen",
        "forward",
        "backward",
        "nav_up",
        "nav_down",
        "nav_left",
        "nav_right",
        "ok",
        "escape",
    }

    def execute_command(action: str) -> bool:
        print(f"Mock command: {action}")
        return True

else:
    from pynput.keyboard import Key, Controller

    _keyboard = Controller()

    _MEDIA_KEYS = {
        "play_pause": Key.media_play_pause,
        "next": Key.media_next,
        "previous": Key.media_previous,
        "volume_up": Key.media_volume_up,
        "volume_down": Key.media_volume_down,
        "mute": Key.media_volume_mute,
    }

    _CHAR_KEYS = {
        "fullscreen": "f",
    }

    _SPECIAL_KEYS = {
        "forward": Key.right,
        "backward": Key.left,
        "nav_up": Key.up,
        "nav_down": Key.down,
        "nav_left": Key.left,
        "nav_right": Key.right,
        "ok": Key.enter,
        "escape": Key.esc,
    }

    VALID_COMMANDS = set(_MEDIA_KEYS) | set(_CHAR_KEYS) | set(_SPECIAL_KEYS)

    def execute_command(action: str) -> bool:
        if action in _MEDIA_KEYS:
            key = _MEDIA_KEYS[action]
            _keyboard.press(key)
            _keyboard.release(key)
            return True

        if action in _SPECIAL_KEYS:
            key = _SPECIAL_KEYS[action]
            _keyboard.press(key)
            _keyboard.release(key)
            return True

        if action in _CHAR_KEYS:
            char = _CHAR_KEYS[action]
            _keyboard.press(char)
            _keyboard.release(char)
            return True

        return False
