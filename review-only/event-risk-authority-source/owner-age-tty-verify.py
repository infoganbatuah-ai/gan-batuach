#!/usr/bin/env python3
"""Owner-run, one-shot age key check. Never accepts a key in argv, env or files.

The owner pastes into this process's terminal stdin with echo disabled. Only a
status and a non-secret receipt are emitted. Python cannot guarantee complete
erasure of internal immutable copies; the mutable input buffer is scrubbed.
"""

import datetime
import hashlib
import json
import os
import re
import resource
import select
import signal
import subprocess
import sys
import termios
import time

AGE_KEYGEN = "/opt/homebrew/bin/age-keygen"
PUBLIC_MANIFEST = "/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/colima-safety.gUVg5H/manifest.json"
PUBLIC_DIGEST = "1fc9645eff132753e75a26eb0856b6f9abe0a26af6002625346832a8a89d97b4"
RECEIPT = "/private/tmp/do-age-owner-key-check-20261028.json"
MAX_KEY_BYTES = 256
KEY_PATTERN = re.compile(rb"AGE-SECRET-KEY-1[A-Z0-9]+\Z")
PUBLIC_PATTERN = re.compile(rb"age1[023456789acdefghjklmnpqrstuvwxyz]+\Z")


class InputUnavailable(Exception):
    pass


def scrub(buffer):
    for index in range(len(buffer)):
        buffer[index] = 0


def pinned_recipient_digest():
    with open(PUBLIC_MANIFEST, "rb") as handle:
        manifest = json.load(handle)
    recipient = manifest.get("publicRecipient")
    if not isinstance(recipient, str) or not PUBLIC_PATTERN.fullmatch(recipient.encode("ascii")):
        raise InputUnavailable()
    if hashlib.sha256(recipient.encode("ascii")).hexdigest() != PUBLIC_DIGEST:
        raise InputUnavailable()
    return PUBLIC_DIGEST


def owner_tty_line(fd, prompt_fd):
    """Read one line from a real TTY, restoring its exact termios settings."""
    if not os.isatty(fd) or not os.isatty(prompt_fd):
        raise InputUnavailable()
    previous = termios.tcgetattr(fd)
    hidden = previous.copy()
    hidden[3] &= ~(termios.ECHO | termios.ECHONL)
    key = bytearray()
    changed = True  # Restore even if tcsetattr partially succeeds.
    try:
        termios.tcsetattr(fd, termios.TCSANOW, hidden)
        if termios.tcgetattr(fd)[3] & (termios.ECHO | termios.ECHONL):
            raise InputUnavailable()
        os.write(prompt_fd, b"Paste the AGE-SECRET-KEY-1 line, then press Return within 2 minutes (hidden): ")
        deadline = time.monotonic() + 120
        while True:
            if not select.select([fd], [], [], max(0, deadline - time.monotonic()))[0]:
                raise InputUnavailable()
            byte = os.read(fd, 1)
            if not byte:
                raise InputUnavailable()
            if byte in (b"\n", b"\r"):
                break
            if len(key) >= MAX_KEY_BYTES:
                raise InputUnavailable()
            key.extend(byte)
        return key
    except BaseException:
        scrub(key)
        raise
    finally:
        if changed:
            try:
                try:
                    termios.tcflush(fd, termios.TCIFLUSH)
                finally:
                    termios.tcsetattr(fd, termios.TCSANOW, previous)
            finally:
                os.write(prompt_fd, b"\n")


def derive_recipient(key):
    """Send the mutable private key over a pipe, never a command argument."""
    try:
        child = subprocess.Popen([AGE_KEYGEN, "-y"], stdin=subprocess.PIPE,
                                 stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                 close_fds=True)
        try:
            view = memoryview(key)
            while view:
                sent = os.write(child.stdin.fileno(), view)
                if sent <= 0:
                    raise InputUnavailable()
                view = view[sent:]
            os.write(child.stdin.fileno(), b"\n")
            child.stdin.close()
            child.stdin = None
            public, _ = child.communicate(timeout=10)
        except BaseException:
            child.kill()
            child.wait()
            raise
    except (OSError, subprocess.TimeoutExpired):
        return None
    if child.returncode != 0:
        return b""
    public = public.strip()
    if not PUBLIC_PATTERN.fullmatch(public):
        return b""
    return public


def verify_key(key, digest=PUBLIC_DIGEST):
    if not key:
        return "EMPTY"
    if not KEY_PATTERN.fullmatch(key):
        return "NO_MATCH"
    public = derive_recipient(key)
    if public is None:
        return "UNAVAILABLE"
    if not public:
        return "NO_MATCH"
    return "MATCH" if hashlib.sha256(public).hexdigest() == digest else "NO_MATCH"


def write_receipt(result, digest=PUBLIC_DIGEST, path=RECEIPT):
    payload = {"result": result, "checkedAtUtc": datetime.datetime.now(datetime.timezone.utc)
               .isoformat(timespec="seconds"), "publicRecipientSha256": digest}
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW
    fd = os.open(path, flags, 0o600)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, separators=(",", ":"))
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
    except BaseException:
        raise


def self_test():
    generated = subprocess.run([AGE_KEYGEN], stdout=subprocess.PIPE,
                               stderr=subprocess.DEVNULL, timeout=10, check=True)
    match = re.search(rb"^AGE-SECRET-KEY-1[A-Z0-9]+$", generated.stdout, re.M)
    public_match = re.search(rb"^# public key: (age1[023456789acdefghjklmnpqrstuvwxyz]+)$",
                             generated.stdout, re.M)
    if not match or not public_match:
        return "UNAVAILABLE"
    key = bytearray(match.group(0))
    try:
        expected = hashlib.sha256(public_match.group(1)).hexdigest()
        if verify_key(key, expected) != "MATCH":
            return "UNAVAILABLE"
        if verify_key(key, "0" * 64) != "NO_MATCH":
            return "UNAVAILABLE"
        return "MATCH"
    finally:
        scrub(key)


def interrupted(_signum, _frame):
    raise InputUnavailable()


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ("--self-test", "--owner-tty"):
        print("UNAVAILABLE")
        return 1
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    if sys.argv[1] == "--self-test":
        result = self_test()
        print(result)
        return 0 if result == "MATCH" else 1
    pinned_recipient_digest()  # Fail before the owner pastes anything.
    if os.path.lexists(RECEIPT):
        raise InputUnavailable()
    for signum in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP, signal.SIGQUIT, signal.SIGTSTP):
        signal.signal(signum, interrupted)
    key = owner_tty_line(sys.stdin.fileno(), sys.stderr.fileno())
    try:
        result = verify_key(key)
    finally:
        scrub(key)
    write_receipt(result)
    print(result)
    return 0 if result == "MATCH" else 1


if __name__ == "__main__":
    try:
        exit_code = main()
    except BaseException:
        print("UNAVAILABLE")
        exit_code = 1
    sys.exit(exit_code)
