from __future__ import annotations

import re
import sys
import tempfile
import zipfile
from pathlib import Path


REDACTIONS = (
    (
        re.compile(rb"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),
        b"[REDACTED_JWT]",
    ),
    (
        re.compile(rb"mysql(?:\+[A-Za-z0-9_-]+)?://[^\s\"'<>]+", re.IGNORECASE),
        b"[REDACTED_DATABASE_URL]",
    ),
    (
        re.compile(
            rb"(app_session_id(?:=|%3D))[A-Za-z0-9._%~-]+", re.IGNORECASE
        ),
        rb"\1[REDACTED]",
    ),
)

TEXT_SUFFIXES = {
    ".css",
    ".html",
    ".js",
    ".json",
    ".md",
    ".network",
    ".stacks",
    ".trace",
    ".txt",
    ".xml",
}


def redact(data: bytes) -> tuple[bytes, int]:
    count = 0
    for pattern, replacement in REDACTIONS:
        data, replacements = pattern.subn(replacement, data)
        count += replacements
    return data, count


def sanitize_zip(path: Path) -> int:
    count = 0
    with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as handle:
        temporary_path = Path(handle.name)
    try:
        with zipfile.ZipFile(path, "r") as source, zipfile.ZipFile(
            temporary_path, "w", compression=zipfile.ZIP_DEFLATED
        ) as target:
            for info in source.infolist():
                data = source.read(info.filename)
                data, replacements = redact(data)
                count += replacements
                target.writestr(info, data)
        temporary_path.replace(path)
    finally:
        temporary_path.unlink(missing_ok=True)
    return count


def sanitize_file(path: Path) -> int:
    if path.suffix.lower() == ".zip":
        return sanitize_zip(path)
    if path.suffix.lower() not in TEXT_SUFFIXES:
        return 0
    data = path.read_bytes()
    sanitized, count = redact(data)
    if count:
        path.write_bytes(sanitized)
    return count


def contains_sensitive_data(path: Path) -> bool:
    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path, "r") as archive:
            return any(
                any(pattern.search(archive.read(info.filename)) for pattern, _ in REDACTIONS)
                for info in archive.infolist()
            )
    if path.suffix.lower() not in TEXT_SUFFIXES:
        return False
    data = path.read_bytes()
    return any(pattern.search(data) for pattern, _ in REDACTIONS)


def main() -> int:
    roots = [Path(value) for value in sys.argv[1:]]
    files = [
        path
        for root in roots
        if root.exists()
        for path in root.rglob("*")
        if path.is_file()
    ]
    replacement_count = sum(sanitize_file(path) for path in files)
    if any(contains_sensitive_data(path) for path in files):
        print("[artifact-safety] sensitive credential material remains")
        return 1
    print(
        "[artifact-safety] report artifacts sanitized",
        {"fileCount": len(files), "replacementCount": replacement_count},
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
