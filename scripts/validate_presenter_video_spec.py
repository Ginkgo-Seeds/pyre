#!/usr/bin/env python3
"""Offline structural validation for the Presenter Video architecture package.

This intentionally uses only the Python standard library so the architecture PR can
be validated without provider credentials, model downloads, network access, or paid
execution. Full JSON-Schema instance validation belongs to P0.01.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PV = ROOT / "capabilities" / "presenter-video"
CAPABILITY = "content.presenter-video.generate"

REQUIRED_FILES = [
    ROOT / "docs" / "architecture" / "presenter-video-engine.md",
    ROOT / "docs" / "research" / "lanshu-audit.md",
    PV / "SKILL.md",
    PV / "PROVIDERS.md",
    PV / "THIRD_PARTY.md",
    PV / "BACKLOG.md",
    PV / "provider-registry.example.yaml",
    PV / "workflows" / "n8n-orchestration.md",
    PV / "contracts" / "skill-request.v1.schema.json",
    PV / "contracts" / "skill-result.v1.schema.json",
    PV / "contracts" / "job.v1.schema.json",
    PV / "contracts" / "provider-adapter.md",
    PV / "contracts" / "failure-taxonomy.v1.yaml",
]

SCHEMA_FILES = [
    PV / "contracts" / "skill-request.v1.schema.json",
    PV / "contracts" / "skill-result.v1.schema.json",
    PV / "contracts" / "job.v1.schema.json",
]

EXPECTED_STATES = {
    "intake",
    "authorization_checked",
    "content_locked",
    "voice_locked",
    "audio_verified",
    "visual_plan_locked",
    "pilot_generated",
    "pilot_verified",
    "full_generation",
    "presenter_verified",
    "composition_built",
    "composition_verified",
    "rendered",
    "delivery_verified",
    "publish_ready",
    "published",
    "blocked",
    "awaiting_approval",
    "retrying",
    "failed",
    "cancelled",
    "archived",
}

FORBIDDEN_TEXT = [
    "sk-proj-",
    "BEGIN PRIVATE KEY",
    "Authorization: Bearer ",
]


def fail(message: str, errors: list[str]) -> None:
    errors.append(message)


def load_json(path: Path, errors: list[str]) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"invalid JSON {path.relative_to(ROOT)}: {exc}", errors)
        return {}
    if not isinstance(value, dict):
        fail(f"schema must be an object: {path.relative_to(ROOT)}", errors)
        return {}
    return value


def find_const(value: object, expected: str) -> bool:
    if isinstance(value, dict):
        if value.get("const") == expected:
            return True
        return any(find_const(item, expected) for item in value.values())
    if isinstance(value, list):
        return any(find_const(item, expected) for item in value)
    return False


def collect_enums(value: object) -> set[str]:
    result: set[str] = set()
    if isinstance(value, dict):
        enum = value.get("enum")
        if isinstance(enum, list):
            result.update(item for item in enum if isinstance(item, str))
        for item in value.values():
            result.update(collect_enums(item))
    elif isinstance(value, list):
        for item in value:
            result.update(collect_enums(item))
    return result


def validate_schema(path: Path, errors: list[str]) -> dict:
    schema = load_json(path, errors)
    if not schema:
        return schema
    if schema.get("$schema") != "https://json-schema.org/draft/2020-12/schema":
        fail(f"unexpected JSON Schema dialect: {path.relative_to(ROOT)}", errors)
    if not str(schema.get("$id", "")).startswith("https://ginkgo.local/schemas/"):
        fail(f"missing/invalid Ginkgo $id: {path.relative_to(ROOT)}", errors)
    if schema.get("type") != "object":
        fail(f"root type must be object: {path.relative_to(ROOT)}", errors)
    if schema.get("additionalProperties") is not False:
        fail(f"root additionalProperties must be false: {path.relative_to(ROOT)}", errors)
    if not find_const(schema, CAPABILITY):
        fail(f"canonical capability const missing: {path.relative_to(ROOT)}", errors)
    return schema


def main() -> int:
    errors: list[str] = []

    for path in REQUIRED_FILES:
        if not path.is_file():
            fail(f"missing required file: {path.relative_to(ROOT)}", errors)

    schemas = {path.name: validate_schema(path, errors) for path in SCHEMA_FILES if path.is_file()}

    request = schemas.get("skill-request.v1.schema.json", {})
    request_version = (
        request.get("properties", {}).get("schema_version", {}).get("const")
        if request
        else None
    )
    if request_version != "skill-request.v1":
        fail("request schema_version must be skill-request.v1", errors)

    result = schemas.get("skill-result.v1.schema.json", {})
    result_version = (
        result.get("properties", {}).get("schema_version", {}).get("const")
        if result
        else None
    )
    if result_version != "skill-result.v1":
        fail("result schema_version must be skill-result.v1", errors)

    job = schemas.get("job.v1.schema.json", {})
    job_version = (
        job.get("properties", {}).get("schema_version", {}).get("const")
        if job
        else None
    )
    if job_version != "presenter-video-job.v1":
        fail("job schema_version must be presenter-video-job.v1", errors)

    for name in ("skill-result.v1.schema.json", "job.v1.schema.json"):
        schema = schemas.get(name, {})
        if schema:
            states = collect_enums(schema)
            missing = EXPECTED_STATES - states
            if missing:
                fail(f"{name} missing states: {sorted(missing)}", errors)

    # Cheap secret-safety guard for the spec package. A real secret scanner remains
    # a repository/organization concern.
    for path in REQUIRED_FILES:
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for needle in FORBIDDEN_TEXT:
            if needle in text:
                fail(f"forbidden secret-like text in {path.relative_to(ROOT)}: {needle!r}", errors)

    if errors:
        print("Presenter Video spec validation FAILED", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("Presenter Video spec validation OK")
    print(f"- required files: {len(REQUIRED_FILES)}")
    print(f"- JSON schemas parsed: {len(SCHEMA_FILES)}")
    print(f"- canonical capability: {CAPABILITY}")
    print(f"- canonical states checked: {len(EXPECTED_STATES)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
