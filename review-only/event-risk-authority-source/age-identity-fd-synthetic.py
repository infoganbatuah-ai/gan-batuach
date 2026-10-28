#!/usr/bin/env python3
"""Synthetic-only proof that age can read an identity from an inherited pipe.

There is deliberately no real-archive or owner-key CLI mode. A future restore
controller must first prove its encrypted destination and no-egress boundary.
"""

import os
import re
import resource
import subprocess
import sys

AGE = "/opt/homebrew/bin/age"
AGE_KEYGEN = "/opt/homebrew/bin/age-keygen"
SENTINEL = b"synthetic restore key transport only\n"


def decrypt_with_inherited_identity(ciphertext, key):
    """Return (exit status, bytes) for a bounded synthetic ciphertext only."""
    if not isinstance(key, bytearray) or len(key) > 256 or not key.startswith(b"AGE-SECRET-KEY-1"):
        raise ValueError("SYNTHETIC_IDENTITY_INVALID")
    if len(ciphertext) > 65536:
        raise ValueError("SYNTHETIC_CIPHERTEXT_CAP")
    read_fd, write_fd = os.pipe()
    try:
        os.write(write_fd, key)
        os.write(write_fd, b"\n")
    finally:
        os.close(write_fd)
    try:
        result = subprocess.run(
            [AGE, "-d", "-i", f"/dev/fd/{read_fd}"],
            input=ciphertext, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            pass_fds=(read_fd,), timeout=10, check=False,
        )
        if len(result.stdout) > 65536:
            raise ValueError("SYNTHETIC_PLAINTEXT_CAP")
        return result.returncode, result.stdout
    finally:
        os.close(read_fd)


def self_test():
    generated = subprocess.run([AGE_KEYGEN], stdout=subprocess.PIPE,
                               stderr=subprocess.DEVNULL, timeout=10, check=True).stdout
    secret = re.search(rb"^AGE-SECRET-KEY-1[A-Z0-9]+$", generated, re.M)
    public = re.search(rb"^# public key: (age1[023456789acdefghjklmnpqrstuvwxyz]+)$", generated, re.M)
    if not secret or not public:
        return False
    key = bytearray(secret.group())
    other_key = None
    try:
        encrypted = subprocess.run([AGE, "-r", public.group(1).decode("ascii")],
                                   input=SENTINEL, stdout=subprocess.PIPE,
                                   stderr=subprocess.DEVNULL, timeout=10, check=True).stdout
        status, plain = decrypt_with_inherited_identity(encrypted, key)
        if status != 0 or plain != SENTINEL:
            return False
        other = subprocess.run([AGE_KEYGEN], stdout=subprocess.PIPE,
                               stderr=subprocess.DEVNULL, timeout=10, check=True).stdout
        other_match = re.search(rb"^AGE-SECRET-KEY-1[A-Z0-9]+$", other, re.M)
        if not other_match:
            return False
        other_key = bytearray(other_match.group())
        wrong_status, wrong_plain = decrypt_with_inherited_identity(encrypted, other_key)
        if wrong_status == 0 or wrong_plain:
            return False
        tampered = bytearray(encrypted)
        tampered[-1] ^= 1
        bad_status, bad_plain = decrypt_with_inherited_identity(bytes(tampered), key)
        return bad_status != 0 and not bad_plain
    finally:
        key[:] = b"\0" * len(key)
        if other_key is not None:
            other_key[:] = b"\0" * len(other_key)


if __name__ == "__main__":
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    if sys.argv != [sys.argv[0], "--self-test"]:
        print("NO_REAL_ARCHIVE_MODE")
        sys.exit(2)
    try:
        passed = self_test()
    except BaseException:
        passed = False
    print("SYNTHETIC_AGE_FD_PASS" if passed else "SYNTHETIC_AGE_FD_FAIL")
    sys.exit(0 if passed else 1)
