import argparse
import asyncio
import json
import logging
import os
import sys
from pathlib import Path

from ably import AblyRealtime
from dotenv import load_dotenv
from pynput.keyboard import Controller, GlobalHotKeys, Key

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

CONNECT_TIMEOUT_SECONDS = 15


def parse_arguments():
    default_key_map_file = Path(__file__).resolve().parent / "command_keys.json"

    parser = argparse.ArgumentParser(
        description="Control a slideshow using gesture commands."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show key presses without actually pressing keys.",
    )
    parser.add_argument(
        "--api-key",
        default=os.environ.get("ABLY_API_KEY"),
        help="Ably API key. Defaults to ABLY_API_KEY from the environment.",
    )
    parser.add_argument(
        "--command-map",
        type=Path,
        default=default_key_map_file,
        help="Path to the JSON command-to-key mapping file.",
    )
    return parser.parse_args()


def load_json(path: Path):
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        raise FileNotFoundError(f"Missing config file: {path}")


def load_channel_name(config_path: Path) -> str:
    config = load_json(config_path)
    if isinstance(config, dict):
        channel_name = config.get("channel")
        if isinstance(channel_name, str) and channel_name.strip():
            return channel_name

    raise ValueError(f"Channel config at {config_path} does not define a 'channel' value.")


def load_command_map(path: Path) -> dict[str, list[str]]:
    config = load_json(path)
    if not isinstance(config, dict):
        raise ValueError(f"Command map at {path} must contain a JSON object.")

    command_map: dict[str, list[str]] = {}
    for command, keys in config.items():
        if not isinstance(keys, list):
            raise ValueError(f"Command '{command}' in {path} is not a list of keys.")
        command_map[command.upper()] = [str(key) for key in keys]
    return command_map


def resolve_key_name(key_name: str):
    normalized = key_name.strip().lower()
    if normalized in {"space", "tab", "enter", "esc", "escape"}:
        return getattr(Key, normalized, key_name)

    if normalized in {"left", "right", "up", "down", "home", "end", "pageup", "pagedown"}:
        return getattr(Key, normalized, key_name)

    if len(normalized) == 1:
        return normalized

    return key_name


def press_keys(keys, dry_run: bool = False) -> None:
    keyboard = None if dry_run else Controller()
    for key_name in keys:
        key = resolve_key_name(key_name)
        if dry_run:
            logger.info('[dry run] key pressed "%s"', display_key_name(key_name))
            continue
        if keyboard is not None:
            keyboard.tap(key)
        logger.info("Key pressed: %s", display_key_name(key_name))


def display_key_name(key_name: str) -> str:
    return {
        "left": "left arrow",
        "right": "right arrow",
        "up": "up arrow",
        "down": "down arrow",
    }.get(key_name.strip().lower(), key_name)


def make_message_handler(command_map: dict[str, list[str]], dry_run: bool):
    def handle_message(message) -> None:
        try:
            payload = message.data if hasattr(message, "data") else message
            if not isinstance(payload, dict):
                logger.warning("Received a non-object Ably message: %r", payload)
                return

            command = payload.get("cmd")
            if command is None:
                logger.warning("Ably message did not include a 'cmd' field: %r", payload)
                return

            command_name = str(command).upper()
            logger.info("Command received: %s", command_name)

            if command_name not in command_map:
                logger.warning("No key mapping is configured for command %s", command_name)
                return

            press_keys(command_map[command_name], dry_run)
        except Exception:
            logger.exception("Failed to process Ably message.")

    return handle_message


async def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    load_dotenv(repo_root / ".env")

    args = parse_arguments()

    if not args.api_key:
        raise RuntimeError(
            "ABLY_API_KEY is not set. Pass --api-key or define the ABLY_API_KEY environment variable."
        )

    channel_config = repo_root / "shared" / "ably-channel-name.json"
    channel_name = load_channel_name(channel_config)
    command_map = load_command_map(args.command_map)

    loop = asyncio.get_running_loop()
    stop_event = asyncio.Event()
    hotkeys = None
    channel = None

    # The realtime client must be created inside the running event loop
    client = AblyRealtime(args.api_key)
    try:
        try:
            await asyncio.wait_for(
                client.connection.once_async("connected"),
                timeout=CONNECT_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            raise RuntimeError(
                f"Could not connect to Ably within {CONNECT_TIMEOUT_SECONDS} seconds. "
                "Check your API key and internet connection."
            )
        logger.info("Connected to Ably.")

        channel = client.channels.get(channel_name)
        await channel.subscribe(make_message_handler(command_map, args.dry_run))
        logger.info("Subscribed to channel '%s'.", channel_name)

        # pynput runs hotkeys on its own thread, so set the event thread-safely
        hotkeys = GlobalHotKeys(
            {"<ctrl>+<alt>+q": lambda: loop.call_soon_threadsafe(stop_event.set)}
        )
        hotkeys.start()
        logger.info("Press Ctrl+Alt+Q to quit.")

        await stop_event.wait()
    finally:
        logger.info("Disconnecting from Ably.")
        if hotkeys is not None:
            hotkeys.stop()
        try:
            if channel is not None:
                channel.unsubscribe()
        finally:
            await client.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Interrupted; shutting down presenter client.")
    except SystemExit:
        raise
    except Exception:
        logger.exception("Presenter client crashed.")
        sys.exit(1)