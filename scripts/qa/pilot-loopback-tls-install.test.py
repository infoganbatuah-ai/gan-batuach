"""Regression checks for transient launchd unregistration and exact ownership."""
import importlib.util
from pathlib import Path
import plistlib
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location("recovery", Path(__file__).with_name("pilot-loopback-tls-install.py"))
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)


class RecoveryControlTests(unittest.TestCase):
    def test_unregister_waits_for_launchd_instead_of_failing_after_bootout(self):
        with patch.object(recovery, "registered", side_effect=[True, True, False]), \
             patch.object(recovery, "run") as run, patch.object(recovery.time, "sleep") as pause:
            recovery.stop("synthetic-service")
            self.assertEqual(run.call_count, 1)
            pause.assert_called_once_with(0.25)

    def test_persistent_service_has_a_bounded_stop(self):
        with patch.object(recovery, "registered", return_value=True), \
             patch.object(recovery, "run"), patch.object(recovery.time, "sleep") as pause:
            with self.assertRaisesRegex(RuntimeError, "DID_NOT_STOP"):
                recovery.stop("synthetic-service")
            self.assertEqual(pause.call_count, 40)

    def test_foreign_ingress_is_never_signalled(self):
        result = Mock(stdout=b"12345\n")
        with patch.object(recovery.subprocess, "run", return_value=result), \
             patch.object(recovery, "run", return_value=b"501 /usr/local/bin/node /unrelated.mjs"), \
             patch.object(recovery.os, "kill") as kill:
            with self.assertRaisesRegex(RuntimeError, "OWNER_NOT_EXACT"):
                recovery.stop_exact_orphan_ingress(plistlib.dumps({"ProgramArguments": ["/usr/local/bin/node", "/expected.mjs"]}))
            kill.assert_not_called()

    def test_only_exact_owned_ingress_receives_term_and_port_must_clear(self):
        busy = Mock(stdout=b"12345\n")
        free = Mock(stdout=b"")
        with patch.object(recovery.subprocess, "run", side_effect=[busy, busy, free]), \
             patch.object(recovery, "run", return_value=f"{recovery.os.getuid()} /usr/local/bin/node /expected.mjs".encode()), \
             patch.object(recovery.os, "kill") as kill, patch.object(recovery.time, "sleep"):
            recovery.stop_exact_orphan_ingress(plistlib.dumps({"ProgramArguments": ["/usr/local/bin/node", "/expected.mjs"]}))
            kill.assert_called_once_with(12345, recovery.signal.SIGTERM)


if __name__ == "__main__":
    unittest.main()
