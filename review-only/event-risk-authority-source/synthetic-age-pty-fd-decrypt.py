#!/usr/bin/env python3
"""Synthetic-only age decrypt bridge for the disposable encrypted restore probe.

The synthetic identity arrives on stdin, is passed through a private PTY, then
through an inherited FD to age. No identity is placed in argv, env, or a file.
This is not a real owner-key entry point.
"""

import os
import re
import resource
import sys
import termios
import tempfile
from pathlib import Path
from subprocess import DEVNULL, run

AGE = "/opt/homebrew/bin/age"
MAX_SYNTHETIC_CIPHERTEXT = 8 * 1024 * 1024
MAX_SYNTHETIC_PLAINTEXT = 8 * 1024 * 1024


def fail(code):
    print(code, file=sys.stderr)
    raise SystemExit(1)


def decrypt(root, ciphertext, output):
    root = Path(root).resolve(strict=True)
    if not root.is_dir() or root.name != "synthetic-components" or not (root / ".synthetic-only").is_file():
        fail("SYNTHETIC_TARGET_REQUIRED")
    ciphertext = Path(ciphertext).resolve(strict=True)
    output = Path(output)
    if ciphertext.parent != root or output.parent.resolve(strict=True) != root or output.exists():
        fail("SYNTHETIC_PATH_DENIED")
    if ciphertext.stat().st_size > MAX_SYNTHETIC_CIPHERTEXT:
        fail("SYNTHETIC_CIPHERTEXT_CAP")
    key = bytearray(sys.stdin.buffer.readline(256).strip())
    if not re.fullmatch(rb"AGE-SECRET-KEY-1[A-Z0-9]+", key):
        fail("SYNTHETIC_IDENTITY_INVALID")
    master, slave = os.openpty()
    read_fd = write_fd = None
    temporary = None
    try:
        attrs = termios.tcgetattr(slave)
        attrs[3] &= ~(termios.ECHO | termios.ICANON)
        termios.tcsetattr(slave, termios.TCSANOW, attrs)
        os.write(master, key + b"\n")
        from_pty = bytearray()
        while len(from_pty) < len(key) + 1:
            chunk = os.read(slave, len(key) + 1 - len(from_pty))
            if not chunk:
                fail("SYNTHETIC_PTY_SHORT_READ")
            from_pty.extend(chunk)
        if from_pty != key + b"\n":
            fail("SYNTHETIC_PTY_MISMATCH")
        read_fd, write_fd = os.pipe()
        os.write(write_fd, from_pty)
        os.close(write_fd)
        write_fd = None
        fd, temporary = tempfile.mkstemp(prefix=".age-partial-", dir=root)
        os.fchmod(fd, 0o600)
        try:
            with os.fdopen(fd, "wb") as plain, open(ciphertext, "rb") as encrypted:
                result = run([AGE, "-d", "-i", f"/dev/fd/{read_fd}"],
                             stdin=encrypted, stdout=plain, stderr=DEVNULL,
                             pass_fds=(read_fd,), timeout=20, check=False)
            if result.returncode != 0 or os.stat(temporary).st_size > MAX_SYNTHETIC_PLAINTEXT:
                fail("SYNTHETIC_AGE_AUTH_FAILED")
            os.replace(temporary, output)
            temporary = None
        finally:
            if temporary is not None:
                os.unlink(temporary)
        print("SYNTHETIC_AGE_DECRYPTED")
    finally:
        key[:] = b"\0" * len(key)
        if "from_pty" in locals():
            from_pty[:] = b"\0" * len(from_pty)
        os.close(master)
        os.close(slave)
        if read_fd is not None:
            os.close(read_fd)
        if write_fd is not None:
            os.close(write_fd)


if __name__ == "__main__":
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    if len(sys.argv) != 5 or sys.argv[1] != "--synthetic-decrypt":
        fail("NO_REAL_ARCHIVE_MODE")
    decrypt(*sys.argv[2:])
