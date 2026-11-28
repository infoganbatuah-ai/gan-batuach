#!/usr/bin/env python3
"""Check backup exclusions using parsed XML and negative mutations, without Android services."""
from copy import deepcopy
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
ANDROID = "{http://schemas.android.com/apk/res/android}"
DOMAINS = frozenset(("root", "file", "database", "sharedpref", "external",
                     "device_root", "device_file", "device_database", "device_sharedpref"))


def validate(manifest, rules):
    app = manifest.find("application")
    if app is None or app.get(ANDROID + "allowBackup") != "false":
        raise ValueError("backup must be disabled")
    if app.get(ANDROID + "fullBackupContent") != "false":
        raise ValueError("legacy backup must be disabled")
    if app.get(ANDROID + "dataExtractionRules") != "@xml/data_extraction_rules":
        raise ValueError("rules resource not linked")
    if rules.tag != "data-extraction-rules" or sorted(x.tag for x in rules) != ["cloud-backup", "device-transfer"]:
        raise ValueError("exact cloud and device modes required")
    for mode in rules:
        entries = list(mode)
        if any(x.tag != "exclude" or set(x.attrib) != {"domain", "path"} or x.get("path") != "." or len(x) for x in entries):
            raise ValueError("only whole-domain exclusions permitted")
        if len(entries) != len(DOMAINS) or {x.get("domain") for x in entries} != DOMAINS:
            raise ValueError("all documented domains must be excluded")


class BackupRules(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = ET.parse(ROOT / "android/app/src/main/AndroidManifest.xml").getroot()
        cls.rules = ET.parse(ROOT / "android/app/src/main/res/xml/data_extraction_rules.xml").getroot()

    def test_actual_policy(self):
        validate(self.manifest, self.rules)

    def test_include_is_rejected(self):
        rules = deepcopy(self.rules)
        ET.SubElement(rules.find("device-transfer"), "include", domain="sharedpref", path=".")
        with self.assertRaises(ValueError):
            validate(self.manifest, rules)

    def test_missing_domain_is_rejected(self):
        rules = deepcopy(self.rules)
        cloud = rules.find("cloud-backup")
        cloud.remove(next(e for e in cloud if e.get("domain") == "device_sharedpref"))
        with self.assertRaises(ValueError):
            validate(self.manifest, rules)

    def test_wrong_manifest_reference_is_rejected(self):
        manifest = deepcopy(self.manifest)
        manifest.find("application").set(ANDROID + "dataExtractionRules", "@xml/other")
        with self.assertRaises(ValueError):
            validate(manifest, self.rules)


if __name__ == "__main__":
    unittest.main()
