#!/usr/bin/env python3
"""Valida a estrutura dos workflows sem ComfyUI, GPU, rede ou credenciais."""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
API_WORKFLOW = ROOT / "workflows" / "identity" / "portrait_consistent_api_v01.json"
MANUAL_WORKFLOW = ROOT / "workflows" / "identity" / "portrait_consistent_manual_v01.json"
EXPECTED = {
    "1": "CheckpointLoaderSimple",
    "2": "CLIPTextEncode",
    "3": "CLIPTextEncode",
    "4": "EmptyLatentImage",
    "5": "KSampler",
    "6": "VAEDecode",
    "7": "SaveImage",
}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def validate_api(workflow: dict) -> list[str]:
    errors: list[str] = []
    for node_id, expected_type in EXPECTED.items():
        node = workflow.get(node_id)
        if not node:
            errors.append(f"API: node {node_id} ausente")
        elif node.get("class_type") != expected_type:
            errors.append(f"API: node {node_id} deveria ser {expected_type}")

    for node_id, input_name in (("2", "clip"), ("3", "clip"), ("5", "model"), ("5", "positive"), ("5", "negative"), ("5", "latent_image"), ("6", "samples"), ("6", "vae"), ("7", "images")):
        value = workflow.get(node_id, {}).get("inputs", {}).get(input_name)
        if not (isinstance(value, list) and len(value) == 2 and value[0] in workflow):
            errors.append(f"API: ligação inválida em {node_id}.{input_name}")

    latent = workflow.get("4", {}).get("inputs", {})
    if latent.get("width") != 1024 or latent.get("height") != 1024 or latent.get("batch_size") != 1:
        errors.append("API: dimensões iniciais devem ser 1024x1024, lote 1")
    if workflow.get("5", {}).get("inputs", {}).get("seed") != 2407202601:
        errors.append("API: seed inicial inesperada")
    return errors


def validate_manual(workflow: dict) -> list[str]:
    errors: list[str] = []
    nodes = {str(node.get("id")): node for node in workflow.get("nodes", [])}
    for node_id, expected_type in EXPECTED.items():
        if node_id not in nodes:
            errors.append(f"Manual: node {node_id} ausente")
        elif nodes[node_id].get("type") != expected_type:
            errors.append(f"Manual: node {node_id} deveria ser {expected_type}")
    if len(workflow.get("links", [])) != 9:
        errors.append("Manual: o workflow deve ter 9 ligações")
    if workflow.get("version") != 0.4:
        errors.append("Manual: versão de workflow inesperada")
    return errors


def main() -> int:
    errors: list[str] = []
    try:
        errors.extend(validate_api(read_json(API_WORKFLOW)))
        errors.extend(validate_manual(read_json(MANUAL_WORKFLOW)))
    except (OSError, json.JSONDecodeError) as error:
        errors.append(f"Não foi possível ler os workflows: {error}")

    if errors:
        print("FALHOU")
        print("\n".join(f"- {error}" for error in errors))
        return 1
    print("OK: os workflows manual e API são JSON válidos e têm os 7 nodes core esperados.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
