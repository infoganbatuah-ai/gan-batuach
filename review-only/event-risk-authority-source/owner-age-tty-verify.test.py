"""Offline synthetic-only qualification for the owner-run no-echo age check."""

import importlib.util
import json
import os
import pty
import select
import signal
import stat
import tempfile
import termios
import threading
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("owner-age-tty-verify.py")
SPEC = importlib.util.spec_from_file_location("owner_age_tty_verify", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def read_available(fd):
    chunks = []
    while select.select([fd], [], [], 0)[0]:
        try:
            chunk = os.read(fd, 4096)
            if not chunk:
                break
            chunks.append(chunk)
        except OSError:
            break
    return b"".join(chunks)


class OwnerTtyVerifyTests(unittest.TestCase):
    def test_synthetic_key_derivation(self):
        self.assertEqual(MODULE.self_test(), "MATCH")
        self.assertEqual(MODULE.verify_key(bytearray(b"AGE-SECRET-KEY-1INVALID")), "NO_MATCH")
        self.assertEqual(MODULE.verify_key(bytearray()), "EMPTY")

    def test_pinned_public_recipient(self):
        self.assertEqual(MODULE.pinned_recipient_digest(), MODULE.PUBLIC_DIGEST)

    def test_tty_hides_input_and_restores_settings(self):
        master, slave = pty.openpty()
        original = termios.tcgetattr(slave)
        result = []
        thread = threading.Thread(target=lambda: result.append(MODULE.owner_tty_line(slave, slave)))
        try:
            thread.start()
            ready = select.select([master], [], [], 3)[0]
            self.assertTrue(ready)
            prompt = os.read(master, 4096)
            self.assertIn(b"(hidden)", prompt)
            synthetic = b"AGE-SECRET-KEY-1SYNTHETICONLY"
            os.write(master, synthetic + b"\n")
            thread.join(3)
            self.assertFalse(thread.is_alive())
            self.assertEqual(result[0], synthetic)
            self.assertNotIn(synthetic, read_available(master))
            self.assertEqual(termios.tcgetattr(slave), original)
            MODULE.scrub(result[0])
            self.assertTrue(all(byte == 0 for byte in result[0]))
        finally:
            os.close(master)
            os.close(slave)

    def test_oversize_input_restores_tty(self):
        master, slave = pty.openpty()
        original = termios.tcgetattr(slave)
        errors = []
        thread = threading.Thread(target=lambda: self._capture_error(slave, errors))
        try:
            thread.start()
            self.assertTrue(select.select([master], [], [], 3)[0])
            os.read(master, 4096)
            os.write(master, b"X" * (MODULE.MAX_KEY_BYTES + 1) + b"\n")
            thread.join(3)
            self.assertFalse(thread.is_alive())
            self.assertEqual(errors, [MODULE.InputUnavailable])
            self.assertEqual(termios.tcgetattr(slave), original)
        finally:
            os.close(master)
            os.close(slave)

    @staticmethod
    def _capture_error(slave, errors):
        try:
            MODULE.owner_tty_line(slave, slave)
        except Exception as error:
            errors.append(type(error))

    def test_signal_restores_tty_without_owner_key(self):
        master, slave = pty.openpty()
        original = termios.tcgetattr(slave)
        previous_handler = signal.getsignal(signal.SIGINT)
        signal.signal(signal.SIGINT, MODULE.interrupted)
        def interrupt_after_prompt():
            if select.select([master], [], [], 3)[0]:
                os.read(master, 4096)
                os.kill(os.getpid(), signal.SIGINT)
        sender = threading.Thread(target=interrupt_after_prompt)
        try:
            sender.start()
            with self.assertRaises(MODULE.InputUnavailable):
                MODULE.owner_tty_line(slave, slave)
            sender.join(3)
            self.assertFalse(sender.is_alive())
            self.assertEqual(termios.tcgetattr(slave), original)
        finally:
            signal.signal(signal.SIGINT, previous_handler)
            os.close(master)
            os.close(slave)

    def test_receipt_has_only_nonsensitive_fields_and_private_mode(self):
        with tempfile.TemporaryDirectory(prefix="do-age-tty-fixture.") as directory:
            path = str(Path(directory, "receipt.json"))
            MODULE.write_receipt("NO_MATCH", path=path)
            content = json.loads(Path(path).read_text())
            self.assertEqual(set(content), {"result", "checkedAtUtc", "publicRecipientSha256"})
            self.assertEqual(content["publicRecipientSha256"], MODULE.PUBLIC_DIGEST)
            self.assertEqual(stat.S_IMODE(os.stat(path).st_mode), 0o600)
            with self.assertRaises(FileExistsError):
                MODULE.write_receipt("MATCH", path=path)


if __name__ == "__main__":
    unittest.main()
