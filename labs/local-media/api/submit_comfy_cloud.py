#!/usr/bin/env python3
"""Submete o workflow inicial ao Comfy Cloud sem depender de bibliotecas externas."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_WORKFLOW = PROJECT_ROOT / "workflows" / "identity" / "portrait_consistent_api_v01.json"
OFFICIAL_COMFY_CLOUD_HOST = "cloud.comfy.org"
REQUIRED_NODES = {
    "1": ("CheckpointLoaderSimple", ("ckpt_name",)),
    "2": ("CLIPTextEncode", ("text", "clip")),
    "3": ("CLIPTextEncode", ("text", "clip")),
    "4": ("EmptyLatentImage", ("width", "height", "batch_size")),
    "5": (
        "KSampler",
        (
            "seed",
            "steps",
            "cfg",
            "sampler_name",
            "scheduler",
            "denoise",
            "model",
            "positive",
            "negative",
            "latent_image",
        ),
    ),
    "6": ("VAEDecode", ("samples", "vae")),
    "7": ("SaveImage", ("filename_prefix", "images")),
}
LINK_INPUTS = (
    ("2", "clip"),
    ("3", "clip"),
    ("5", "model"),
    ("5", "positive"),
    ("5", "negative"),
    ("5", "latent_image"),
    ("6", "samples"),
    ("6", "vae"),
    ("7", "images"),
)


def load_dotenv(path: Path) -> None:
    """Carrega pares simples KEY=VALUE sem substituir variáveis já existentes."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Submete um workflow API-format ao Comfy Cloud. Use --dry-run primeiro."
    )
    parser.add_argument("--workflow", type=Path, default=DEFAULT_WORKFLOW, help="JSON em formato API")
    parser.add_argument("--env-file", type=Path, default=PROJECT_ROOT / ".env", help="Arquivo local de variáveis")
    parser.add_argument("--prompt", help="Substitui o prompt positivo do node 2")
    parser.add_argument("--negative-prompt", help="Substitui o prompt negativo do node 3")
    parser.add_argument("--seed", type=int, help="Substitui a seed do node 5")
    parser.add_argument("--checkpoint", help="Substitui o checkpoint do node 1")
    parser.add_argument(
        "--allow-custom-host",
        action="store_true",
        help="Permite enviar para host HTTPS diferente de cloud.comfy.org",
    )
    parser.add_argument("--dry-run", action="store_true", help="Valida e mostra a solicitação sem rede")
    return parser.parse_args()


def validate_workflow(workflow: object) -> dict:
    """Valida nodes, tipos, inputs obrigatórios e ligações do workflow API-format."""
    if not isinstance(workflow, dict):
        raise ValueError("Workflow deve ser um objeto JSON com nodes identificados por chave.")

    missing_nodes = [node_id for node_id in REQUIRED_NODES if node_id not in workflow]
    if missing_nodes:
        raise ValueError(f"Workflow não contém os nodes obrigatórios: {', '.join(missing_nodes)}.")

    for node_id, (expected_type, required_inputs) in REQUIRED_NODES.items():
        node = workflow[node_id]
        if not isinstance(node, dict):
            raise ValueError(f"Node {node_id} deve ser um objeto JSON.")
        if "class_type" not in node:
            raise ValueError(f"Campo interno obrigatório ausente: node {node_id}.class_type.")
        if node["class_type"] != expected_type:
            raise ValueError(
                f"Node {node_id} deveria ser {expected_type}, mas recebeu {node['class_type']!r}."
            )
        inputs = node.get("inputs")
        if not isinstance(inputs, dict):
            raise ValueError(f"Campo interno obrigatório ausente ou inválido: node {node_id}.inputs.")
        missing_inputs = [name for name in required_inputs if name not in inputs]
        if missing_inputs:
            names = ", ".join(f"node {node_id}.inputs.{name}" for name in missing_inputs)
            raise ValueError(f"Campos internos obrigatórios ausentes: {names}.")

    for node_id, input_name in LINK_INPUTS:
        link = workflow[node_id]["inputs"][input_name]
        if (
            not isinstance(link, list)
            or len(link) != 2
            or not isinstance(link[0], str)
            or link[0] not in workflow
            or not isinstance(link[1], int)
            or isinstance(link[1], bool)
            or link[1] < 0
        ):
            raise ValueError(f"Ligação interna inválida: node {node_id}.inputs.{input_name}.")

    return workflow


def load_workflow(path: Path) -> dict:
    try:
        workflow = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ValueError(f"Workflow não encontrado: {path}") from error
    except json.JSONDecodeError as error:
        raise ValueError(f"Workflow JSON inválido: {error}") from error
    except UnicodeDecodeError as error:
        raise ValueError(f"Workflow não está codificado em UTF-8: {path}") from error

    return validate_workflow(workflow)


def validate_base_url(base_url: str, allow_custom_host: bool = False) -> str:
    """Exige HTTPS e bloqueia o envio da chave para hosts não autorizados por padrão."""
    parsed = urlparse(base_url)
    if parsed.scheme.lower() != "https" or not parsed.hostname:
        raise ValueError("COMFY_CLOUD_BASE_URL deve ser uma URL HTTPS válida.")
    if parsed.username or parsed.password:
        raise ValueError("COMFY_CLOUD_BASE_URL não pode conter usuário ou senha.")

    hostname = parsed.hostname.lower().rstrip(".")
    if hostname != OFFICIAL_COMFY_CLOUD_HOST and not allow_custom_host:
        raise ValueError(
            f"Host não autorizado: {hostname}. Use cloud.comfy.org ou confirme conscientemente "
            "com --allow-custom-host."
        )
    return base_url.rstrip("/")


def override_inputs(workflow: dict, args: argparse.Namespace) -> dict:
    checkpoint = args.checkpoint or os.getenv("COMFY_CHECKPOINT_NAME")
    if checkpoint:
        workflow["1"]["inputs"]["ckpt_name"] = checkpoint
    if args.prompt:
        workflow["2"]["inputs"]["text"] = args.prompt
    if args.negative_prompt:
        workflow["3"]["inputs"]["text"] = args.negative_prompt
    if args.seed is not None:
        workflow["5"]["inputs"]["seed"] = args.seed
    return workflow


def safe_summary(workflow: dict, base_url: str) -> str:
    """Resumo sem chaves de API ou cabeçalhos de autenticação."""
    summary = {
        "mode": "dry-run",
        "endpoint": f"{base_url.rstrip('/')}/api/prompt",
        "checkpoint": workflow["1"]["inputs"]["ckpt_name"],
        "seed": workflow["5"]["inputs"]["seed"],
        "dimensions": {
            "width": workflow["4"]["inputs"]["width"],
            "height": workflow["4"]["inputs"]["height"],
            "batch_size": workflow["4"]["inputs"]["batch_size"],
        },
        "node_count": len(workflow),
    }
    return json.dumps(summary, ensure_ascii=False, indent=2)


def submit(base_url: str, api_key: str, workflow: dict) -> dict:
    body = json.dumps({"prompt": workflow}).encode("utf-8")
    request = Request(
        f"{base_url.rstrip('/')}/api/prompt",
        data=body,
        headers={"Content-Type": "application/json", "X-API-Key": api_key},
        method="POST",
    )
    with urlopen(request, timeout=60) as response:  # nosec B310: URL vem de configuração explícita do operador.
        return json.loads(response.read().decode("utf-8"))


def require_prompt_id(result: object) -> str:
    """Recusa respostas de submissão que não comprovem a criação de um job."""
    if not isinstance(result, dict):
        raise ValueError("Resposta do Comfy Cloud não é um objeto JSON.")
    prompt_id = result.get("prompt_id")
    if not isinstance(prompt_id, str) or not prompt_id.strip():
        raise ValueError("Resposta do Comfy Cloud não contém um prompt_id válido.")
    return prompt_id


def main() -> int:
    args = parse_args()
    load_dotenv(args.env_file)

    try:
        base_url = validate_base_url(
            os.getenv("COMFY_CLOUD_BASE_URL", "https://cloud.comfy.org"),
            allow_custom_host=args.allow_custom_host,
        )
        workflow = override_inputs(load_workflow(args.workflow), args)
    except ValueError as error:
        print(f"Erro de validação: {error}", file=sys.stderr)
        return 2

    if args.dry_run:
        print(safe_summary(workflow, base_url))
        return 0

    api_key = os.getenv("COMFY_CLOUD_API_KEY", "")
    if not api_key:
        print("COMFY_CLOUD_API_KEY não foi definida. Use --dry-run ou crie um .env local.", file=sys.stderr)
        return 2

    try:
        result = submit(base_url, api_key, workflow)
    except HTTPError as error:
        print(f"Comfy Cloud recusou a solicitação (HTTP {error.code}). Verifique assinatura, chave e workflow.", file=sys.stderr)
        return 1
    except URLError:
        print("Não foi possível conectar ao Comfy Cloud. Verifique sua rede e COMFY_CLOUD_BASE_URL.", file=sys.stderr)
        return 1
    except (TimeoutError, json.JSONDecodeError):
        print("A solicitação não retornou uma resposta JSON válida. Consulte o status no Comfy Cloud.", file=sys.stderr)
        return 1

    try:
        prompt_id = require_prompt_id(result)
    except ValueError as error:
        print(f"Erro de submissão: {error}", file=sys.stderr)
        return 1

    print(json.dumps({"status": "submitted", "prompt_id": prompt_id, "node_errors": result.get("node_errors", {})}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
