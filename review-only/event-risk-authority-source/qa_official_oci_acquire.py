"""Rebuild one pinned public ARM64 Docker-save QA archive on Kingston.

No Docker daemon, cloud account, existing database or guest is contacted. The
anonymous ECR token and signed/pinned metadata must already be in private
scratch. Network access is only for the 29 exact compressed OCI blob digests.
"""

import argparse
import gzip
import hashlib
import io
import json
import os
import stat
import subprocess
import tarfile
import tempfile
from pathlib import Path

ROOT_PREFIX = "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/.qa-offline-vz-"
MANIFEST_SHA = "e3fb2c4a4376423f4eb1f1b1d87490a4ec23bdcdb97d3fc29e691f5a3c4abd9d"
CONFIG_SHA = "ed2c675a446d78a346e88f18afb6ae0cf46f64251f8c9186446bdf1526dd3655"
ARCHIVE_SHA = "51c3b993f6ec02b579665fcd56c4f126107dd474e97f6fcf723e66c703c30e27"
ARCHIVE_BYTES = 1_330_063_360
MAX_ARTIFACT = 2 * 1024 ** 3
TAG = "public.ecr.aws/supabase/postgres:17.6.1.167"
SF_DATALESS = 0x40000000  # macOS sys/stat.h


class QAImageError(ValueError):
    pass


def require(condition, code):
    if not condition:
        raise QAImageError(code)


def private_file(path, cap):
    st = path.lstat()
    require(stat.S_ISREG(st.st_mode) and st.st_nlink == 1 and
            st.st_uid == os.getuid() and stat.S_IMODE(st.st_mode) == 0o600 and
            0 < st.st_size <= cap and st.st_blocks > 0 and
            not (st.st_flags & SF_DATALESS), "QA_OCI_FILE_NOT_PRIVATE_LOCAL")
    return st


def hash_file(path, cap):
    before = private_file(path, cap)
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        opened = os.fstat(fd)
        require((opened.st_ino, opened.st_size, opened.st_mtime_ns) ==
                (before.st_ino, before.st_size, before.st_mtime_ns),
                "QA_OCI_FILE_CHANGED")
        h = hashlib.sha256()
        with os.fdopen(fd, "rb", closefd=False) as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                h.update(chunk)
        after = os.fstat(fd)
        require((after.st_ino, after.st_size, after.st_mtime_ns) ==
                (before.st_ino, before.st_size, before.st_mtime_ns),
                "QA_OCI_FILE_CHANGED")
        return h.hexdigest(), before.st_size
    finally:
        os.close(fd)


def load_pinned_metadata(scratch):
    manifest_path = scratch / "supabase-postgres-arm64-manifest-raw.json.part"
    config_path = scratch / "supabase-postgres-arm64-config.json.part"
    require(hash_file(manifest_path, 10_000)[0] == MANIFEST_SHA,
            "QA_OCI_MANIFEST_HASH_MISMATCH")
    require(hash_file(config_path, 20_000)[0] == CONFIG_SHA,
            "QA_OCI_CONFIG_HASH_MISMATCH")
    manifest_bytes = manifest_path.read_bytes()
    config_bytes = config_path.read_bytes()
    manifest, config = json.loads(manifest_bytes), json.loads(config_bytes)
    require(manifest.get("schemaVersion") == 2 and
            manifest.get("mediaType") == "application/vnd.oci.image.manifest.v1+json" and
            manifest.get("config", {}).get("digest") == f"sha256:{CONFIG_SHA}" and
            manifest.get("config", {}).get("size") == len(config_bytes),
            "QA_OCI_MANIFEST_CONFIG_INVALID")
    layers = manifest.get("layers")
    diff_ids = config.get("rootfs", {}).get("diff_ids")
    require(config.get("architecture") == "arm64" and config.get("os") == "linux" and
            config.get("rootfs", {}).get("type") == "layers" and
            isinstance(layers, list) and len(layers) == 29 and
            isinstance(diff_ids, list) and len(diff_ids) == 29,
            "QA_OCI_ARM64_LAYER_INVENTORY_INVALID")
    require(all(x.get("mediaType") == "application/vnd.oci.image.layer.v1.tar+gzip" and
                isinstance(x.get("size"), int) and 0 < x["size"] < MAX_ARTIFACT and
                isinstance(x.get("digest"), str) and x["digest"].startswith("sha256:") and
                len(x["digest"]) == 71 and
                all(c in "0123456789abcdef" for c in x["digest"][7:])
                for x in layers), "QA_OCI_LAYER_DESCRIPTOR_INVALID")
    require(sum(x["size"] for x in layers) < MAX_ARTIFACT and
            len({x["digest"] for x in layers}) == 29 and
            all(isinstance(x, str) and x.startswith("sha256:") and len(x) == 71
                for x in diff_ids), "QA_OCI_LAYER_BUDGET_OR_DIFF_ID_INVALID")
    return layers, diff_ids, config_bytes


def download_blob(scratch, token, descriptor):
    digest = descriptor["digest"][7:]
    expected_size = descriptor["size"]
    blobs = scratch / "blobs"
    if not blobs.exists():
        blobs.mkdir(mode=0o700)
    require(not blobs.is_symlink() and stat.S_IMODE(blobs.stat().st_mode) == 0o700,
            "QA_OCI_BLOB_DIR_UNSAFE")
    target = blobs / digest
    if target.exists():
        actual_hash, actual_size = hash_file(target, expected_size)
        require(actual_hash == digest and actual_size == expected_size,
                "QA_OCI_EXISTING_BLOB_MISMATCH")
        return target
    fd, name = tempfile.mkstemp(prefix=".blob-", dir=blobs)
    os.close(fd)
    temp = Path(name)
    try:
        command = ["curl", "--fail", "--location", "--max-redirs", "3",
                   "--proto", "=https", "--proto-redir", "=https",
                   "--tlsv1.2", "--silent", "--show-error", "--max-time", "1200",
                   "--max-filesize", str(expected_size), "--config", "-",
                   "--output", str(temp),
                   f"https://public.ecr.aws/v2/supabase/postgres/blobs/sha256:{digest}"]
        config = f'header = "Authorization: Bearer {token}"\n'
        result = subprocess.run(command, input=config, text=True,
                                stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
                                timeout=1210, check=False)
        require(result.returncode == 0, "QA_OCI_BLOB_DOWNLOAD_FAILED")
        actual_hash, actual_size = hash_file(temp, expected_size)
        require(actual_hash == digest and actual_size == expected_size,
                "QA_OCI_BLOB_DIGEST_OR_SIZE_MISMATCH")
        require(not target.exists(), "QA_OCI_BLOB_TARGET_RACE")
        os.rename(temp, target)
        return target
    finally:
        if temp.exists():
            temp.unlink()


def add_bytes(archive, name, data):
    info = tarfile.TarInfo(name)
    info.size = len(data)
    info.mode = 0o600
    info.mtime = 0
    archive.addfile(info, io.BytesIO(data))


def build_archive(scratch, layers, diff_ids, config_bytes):
    output = scratch / "supabase-postgres-arm64-docker-save.tar"
    require(not output.exists() and not output.is_symlink(),
            "QA_OCI_ARCHIVE_ALREADY_EXISTS")
    fd, name = tempfile.mkstemp(prefix=".docker-save-", dir=scratch)
    temp = Path(name)
    layer_names = [f"layers/{index:02d}/layer.tar" for index in range(29)]
    docker_manifest = [{"Config": "supabase-postgres-arm64-config.json",
                        "RepoTags": [TAG], "Layers": layer_names}]
    try:
        with os.fdopen(fd, "wb") as output_stream:
            with tarfile.open(fileobj=output_stream, mode="w",
                              format=tarfile.PAX_FORMAT) as archive:
                add_bytes(archive, "supabase-postgres-arm64-config.json", config_bytes)
                add_bytes(archive, "manifest.json",
                          (json.dumps(docker_manifest, separators=(",", ":")) + "\n").encode())
                total_raw = 0
                for index, (layer, diff) in enumerate(zip(layers, diff_ids)):
                    compressed = scratch / "blobs" / layer["digest"][7:]
                    require(hash_file(compressed, layer["size"])[0] == layer["digest"][7:],
                            "QA_OCI_BLOB_CHANGED_BEFORE_PACK")
                    layer_fd, layer_name = tempfile.mkstemp(prefix=".unpacked-", dir=scratch)
                    unpacked = Path(layer_name)
                    try:
                        digest = hashlib.sha256()
                        size = 0
                        with os.fdopen(layer_fd, "wb") as raw, gzip.open(compressed, "rb") as gz:
                            for chunk in iter(lambda: gz.read(1024 * 1024), b""):
                                size += len(chunk)
                                total_raw += len(chunk)
                                require(total_raw < MAX_ARTIFACT,
                                        "QA_OCI_UNCOMPRESSED_BUDGET_EXCEEDED")
                                digest.update(chunk)
                                raw.write(chunk)
                            raw.flush()
                            os.fsync(raw.fileno())
                        require(f"sha256:{digest.hexdigest()}" == diff,
                                "QA_OCI_DIFF_ID_MISMATCH")
                        info = tarfile.TarInfo(layer_names[index])
                        info.size = size
                        info.mode = 0o600
                        info.mtime = 0
                        with unpacked.open("rb") as raw:
                            archive.addfile(info, raw)
                        require(output_stream.tell() < MAX_ARTIFACT,
                                "QA_OCI_ARCHIVE_BUDGET_EXCEEDED")
                    finally:
                        unpacked.unlink(missing_ok=True)
            output_stream.flush()
            os.fsync(output_stream.fileno())
        actual_hash, actual_size = hash_file(temp, MAX_ARTIFACT)
        require(actual_size == ARCHIVE_BYTES and actual_hash == ARCHIVE_SHA,
                "QA_OCI_REBUILT_ARCHIVE_MISMATCH")
        os.rename(temp, output)
        return actual_size, actual_hash
    finally:
        # A mismatched deterministic archive is not an approved QA input.
        temp.unlink(missing_ok=True)


def run(scratch_arg):
    scratch = Path(scratch_arg)
    require(str(scratch).startswith(ROOT_PREFIX) and scratch.is_absolute() and
            not scratch.is_symlink() and scratch.resolve() == scratch,
            "QA_OCI_SCRATCH_PATH_UNSAFE")
    st = scratch.stat()
    require(stat.S_ISDIR(st.st_mode) and st.st_uid == os.getuid() and
            stat.S_IMODE(st.st_mode) == 0o700, "QA_OCI_SCRATCH_NOT_PRIVATE")
    free = os.statvfs(scratch).f_bavail * os.statvfs(scratch).f_frsize
    require(free >= 8 * 1024 ** 3, "QA_OCI_SCRATCH_CAPACITY_UNPROVEN")
    token_file = scratch / "ecr-public-token.json.part"
    private_file(token_file, 10_000)
    token = json.loads(token_file.read_text())["token"]
    require(isinstance(token, str) and 32 <= len(token) <= 4096,
            "QA_OCI_ANONYMOUS_TOKEN_INVALID")
    layers, diff_ids, config_bytes = load_pinned_metadata(scratch)
    for index, layer in enumerate(layers):
        download_blob(scratch, token, layer)
        print(f"QA_OCI_BLOB_VERIFIED index={index + 1}/29 bytes={layer['size']}", flush=True)
    size, digest = build_archive(scratch, layers, diff_ids, config_bytes)
    print(f"QA_OCI_ARCHIVE_VERIFIED bytes={size} sha256={digest}", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scratch", required=True)
    args = parser.parse_args()
    try:
        run(args.scratch)
    except (OSError, QAImageError, KeyError, json.JSONDecodeError,
            gzip.BadGzipFile, subprocess.TimeoutExpired):
        raise SystemExit("QA_OCI_ACQUISITION_BLOCKED; inspect sanitized receipt") from None
