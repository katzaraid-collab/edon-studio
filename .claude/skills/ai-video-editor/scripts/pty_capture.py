#!/usr/bin/env python3
"""Drive a real CLI inside a PTY, render the screen buffer to HTML.

Used to shoot genuine terminal frames as B-roll — the text on screen is what the
program actually printed, not a mock-up. `screencapture` is usually blocked in an
agent harness, and computer-use cannot type into a terminal; a PTY can do both.

Gotchas (references/graphics.md):
  * a TUI needs ~10-13s to finish first paint — typing at 3s captures a blank screen
  * run it in a CLEAN folder with no MCP/agent config, or it opens on a trust prompt
  * many TUIs show a trust-folder prompt on a new directory: send b"\r" first
  * capture NARROW: 76 cols for a 1080x900 panel, 68 full-frame, 52 for a payoff shot
  * REDACT at this buffer level, not in the HTML — colour changes split a line across
    spans, so a string replace on the markup misses. Pad the replacement to the
    original length or you leave a stray tail character.
"""
import os, pty, sys, time, select, json, html, argparse, signal

try:
    import pyte
except ImportError:
    raise SystemExit("missing optional dependency: pyte\n\n"
                     "  terminal B-roll capture needs it; nothing else does.\n"
                     "    pip install pyte\n")

COLS, ROWS = 76, 26   # 96 cols renders as unreadable 13px type on a vertical frame


def run(cmd, script, out_json, cols=COLS, rows=ROWS, settle=2.5):
    """script = list of (delay_seconds, bytes_to_send, snapshot_name or None)"""
    screen = pyte.HistoryScreen(cols, rows)
    stream = pyte.ByteStream(screen)
    pid, fd = pty.fork()
    if pid == 0:
        env = dict(os.environ)
        env["TERM"] = "xterm-256color"
        env["COLUMNS"] = str(cols)
        env["LINES"] = str(rows)
        env["CI"] = ""
        os.execvpe(cmd[0], cmd, env)

    import fcntl, termios, struct
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))

    snaps = {}

    def pump(seconds):
        end = time.time() + seconds
        while time.time() < end:
            r, _, _ = select.select([fd], [], [], 0.1)
            if fd in r:
                try:
                    data = os.read(fd, 65536)
                except OSError:
                    return False
                if not data:
                    return False
                stream.feed(data)
        return True

    def grab(name):
        rendered = []
        for y in range(rows):
            line = []
            for x in range(cols):
                ch = screen.buffer[y][x]
                line.append({
                    "c": ch.data,
                    "fg": ch.fg, "bg": ch.bg,
                    "b": ch.bold, "i": ch.italics, "r": ch.reverse,
                })
            rendered.append(line)
        snaps[name] = {"cols": cols, "rows": rows, "cells": rendered,
                       "cursor": [screen.cursor.x, screen.cursor.y]}

    pump(settle)
    for delay, payload, name in script:
        if payload:
            os.write(fd, payload)
        pump(delay)
        if name:
            grab(name)

    try:
        os.kill(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    os.close(fd)
    json.dump(snaps, open(out_json, "w"), ensure_ascii=False)
    print("snapshots:", list(snaps))


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--cols", type=int, default=COLS)
    p.add_argument("--rows", type=int, default=ROWS)
    p.add_argument("cmd", nargs=argparse.REMAINDER)
    a = p.parse_args()
    cmd = a.cmd[1:] if a.cmd and a.cmd[0] == "--" else a.cmd
    run(cmd, [(1.0, None, "final")], a.out, a.cols, a.rows)
