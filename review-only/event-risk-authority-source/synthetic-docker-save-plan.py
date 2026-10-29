"""Bounded Docker-save planner for small synthetic fixtures only.

The returned layer data can be converted into SyntheticLayer fixtures for the
separate extractor. This module never extracts or starts an image.
"""

from __future__ import annotations

import hashlib
import io
import json
import re
import tarfile
from dataclasses import dataclass


MAX_ARCHIVE_BYTES = 32 * 1024 * 1024
MAX_LAYER_BYTES = 8 * 1024 * 1024
MAX_METADATA_BYTES = 64 * 1024
LAYER_COUNT = 29
SYNTHETIC_TAG = "do-qa-synthetic:fixture"
_SHA = re.compile(r"[0-9a-f]{64}\Z")
_LAYER = re.compile(r"layers/([0-9a-f]{64})/layer\.tar\Z")


class UnsafeDockerSave(ValueError):
    pass


@dataclass(frozen=True)
class PlannedLayer:
    index: int
    data: bytes
    sha256: str


def _unique_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise UnsafeDockerSave("DUPLICATE_JSON_KEY")
        result[key] = value
    return result


def _json(data, label):
    try:
        return json.loads(data, object_pairs_hook=_unique_pairs)
    except (UnicodeError, json.JSONDecodeError) as error:
        raise UnsafeDockerSave(label + "_INVALID_JSON") from error


def plan_synthetic_docker_save(archive_bytes: bytes, archive_sha256: str,
                               *, purpose: str) -> dict:
    """Pin a 31-file, 29-layer synthetic Docker-save archive before use.

    Input is intentionally bytes with a 32-MiB ceiling; the real QA image is
    over 1 GiB and cannot be opened by this API. No path or network is read.
    """
    if purpose != "synthetic-fixture-only":
        raise UnsafeDockerSave("SYNTHETIC_PURPOSE_REQUIRED")
    if not isinstance(archive_bytes, bytes) or not 0 < len(archive_bytes) <= MAX_ARCHIVE_BYTES:
        raise UnsafeDockerSave("ARCHIVE_BUDGET_INVALID")
    if not isinstance(archive_sha256, str) or not _SHA.fullmatch(archive_sha256) or \
            hashlib.sha256(archive_bytes).hexdigest() != archive_sha256:
        raise UnsafeDockerSave("ARCHIVE_DIGEST_INVALID")

    files = {}
    try:
        with tarfile.open(fileobj=io.BytesIO(archive_bytes), mode="r:") as archive:
            for entry in archive:
                if not entry.isfile() or entry.issparse() or entry.name in files or \
                        entry.name.startswith("/") or ".." in entry.name.split("/") or \
                        "\\" in entry.name:
                    raise UnsafeDockerSave("ARCHIVE_ENTRY_INVALID")
                if entry.name == "manifest.json" or re.fullmatch(r"[0-9a-f]{64}\.json", entry.name):
                    limit = MAX_METADATA_BYTES
                elif _LAYER.fullmatch(entry.name):
                    limit = MAX_LAYER_BYTES
                else:
                    raise UnsafeDockerSave("ARCHIVE_ENTRY_UNEXPECTED")
                if len(files) >= LAYER_COUNT + 2:
                    raise UnsafeDockerSave("ARCHIVE_ENTRY_COUNT_EXCEEDED")
                if entry.size < 0 or entry.size > limit:
                    raise UnsafeDockerSave("ARCHIVE_ENTRY_BUDGET_INVALID")
                source = archive.extractfile(entry)
                if source is None:
                    raise UnsafeDockerSave("ARCHIVE_ENTRY_UNREADABLE")
                data = source.read(limit + 1)
                if len(data) != entry.size:
                    raise UnsafeDockerSave("ARCHIVE_ENTRY_TRUNCATED")
                files[entry.name] = data
    except (tarfile.TarError, OSError, EOFError) as error:
        raise UnsafeDockerSave("ARCHIVE_TAR_INVALID") from error

    manifest = _json(files.get("manifest.json", b""), "MANIFEST")
    if not isinstance(manifest, list) or len(manifest) != 1 or \
            not isinstance(manifest[0], dict) or set(manifest[0]) != {"Config", "RepoTags", "Layers"}:
        raise UnsafeDockerSave("MANIFEST_SHAPE_INVALID")
    item = manifest[0]
    config_name = item["Config"]
    names = item["Layers"]
    if not isinstance(config_name, str) or not re.fullmatch(r"[0-9a-f]{64}\.json", config_name) or \
            item["RepoTags"] != [SYNTHETIC_TAG] or not isinstance(names, list) or \
            len(names) != LAYER_COUNT or any(not isinstance(name, str) or
                                            not _LAYER.fullmatch(name) for name in names) or \
            len(set(names)) != LAYER_COUNT or set(files) != {"manifest.json", config_name, *names}:
        raise UnsafeDockerSave("MANIFEST_REFERENCE_INVALID")

    config_data = files[config_name]
    if hashlib.sha256(config_data).hexdigest() + ".json" != config_name:
        raise UnsafeDockerSave("CONFIG_DIGEST_INVALID")
    config = _json(config_data, "CONFIG")
    if not isinstance(config, dict) or config.get("architecture") != "arm64" or \
            config.get("os") != "linux" or not isinstance(config.get("rootfs"), dict) or \
            set(config["rootfs"]) != {"type", "diff_ids"} or \
            config["rootfs"]["type"] != "layers" or \
            not isinstance(config["rootfs"]["diff_ids"], list) or \
            len(config["rootfs"]["diff_ids"]) != LAYER_COUNT:
        raise UnsafeDockerSave("CONFIG_SHAPE_INVALID")
    layers = []
    for index, name in enumerate(names):
        data = files[name]
        digest = hashlib.sha256(data).hexdigest()
        if config["rootfs"]["diff_ids"][index] != "sha256:" + digest:
            raise UnsafeDockerSave("LAYER_DIFF_ID_MISMATCH")
        layers.append(PlannedLayer(index, data, digest))
    return {"status": "SYNTHETIC_PLAN_ONLY", "archive_sha256": archive_sha256,
            "config_sha256": config_name[:-5], "architecture": "arm64",
            "layer_count": LAYER_COUNT, "layers": layers}
