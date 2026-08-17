#!/usr/bin/env python3
"""Testes locais do cliente Comfy Cloud, sempre sem rede e sem credenciais reais."""

from __future__ import annotations

import io
import os
import tempfile
import unittest
from argparse import Namespace
from contextlib import redirect_stderr, redirect_stdout
from copy import deepcopy
from pathlib import Path
from unittest.mock import patch

from api import submit_comfy_cloud as client


class SubmitComfyCloudTests(unittest.TestCase):
    def make_args(self, **overrides) -> Namespace:
        values = {
            "workflow": client.DEFAULT_WORKFLOW,
            "env_file": client.PROJECT_ROOT / ".env.test-does-not-exist",
            "prompt": None,
            "negative_prompt": None,
            "seed": None,
            "checkpoint": None,
            "allow_custom_host": False,
            "dry_run": False,
        }
        values.update(overrides)
        return Namespace(**values)

    def test_valid_workflow(self) -> None:
        workflow = client.load_workflow(client.DEFAULT_WORKFLOW)

        self.assertEqual(workflow["1"]["class_type"], "CheckpointLoaderSimple")
        self.assertEqual(workflow["7"]["class_type"], "SaveImage")

    def test_invalid_json_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            invalid_path = Path(temporary_directory) / "invalid.json"
            invalid_path.write_text('{"1": ', encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "Workflow JSON inválido"):
                client.load_workflow(invalid_path)

    def test_missing_node_is_rejected(self) -> None:
        workflow = deepcopy(client.load_workflow(client.DEFAULT_WORKFLOW))
        del workflow["7"]

        with self.assertRaisesRegex(ValueError, "nodes obrigatórios: 7"):
            client.validate_workflow(workflow)

    def test_missing_internal_field_is_rejected(self) -> None:
        workflow = deepcopy(client.load_workflow(client.DEFAULT_WORKFLOW))
        del workflow["5"]["inputs"]["seed"]

        with self.assertRaisesRegex(ValueError, r"node 5\.inputs\.seed"):
            client.validate_workflow(workflow)

    def test_response_without_prompt_id_is_an_execution_error(self) -> None:
        args = self.make_args()
        stderr = io.StringIO()
        environment = {
            "COMFY_CLOUD_API_KEY": "test-placeholder-key",
            "COMFY_CLOUD_BASE_URL": "https://cloud.comfy.org",
        }

        with (
            patch.object(client, "parse_args", return_value=args),
            patch.object(client, "submit", return_value={"node_errors": {}}) as submit_mock,
            patch.dict(os.environ, environment, clear=False),
            redirect_stderr(stderr),
        ):
            result = client.main()

        self.assertEqual(result, 1)
        self.assertIn("prompt_id", stderr.getvalue())
        submit_mock.assert_called_once()

    def test_unauthorized_host_is_blocked_before_submission(self) -> None:
        args = self.make_args()
        stderr = io.StringIO()
        environment = {
            "COMFY_CLOUD_API_KEY": "test-placeholder-key",
            "COMFY_CLOUD_BASE_URL": "https://example.invalid",
        }

        with (
            patch.object(client, "parse_args", return_value=args),
            patch.object(client, "submit") as submit_mock,
            patch.dict(os.environ, environment, clear=False),
            redirect_stderr(stderr),
        ):
            result = client.main()

        self.assertEqual(result, 2)
        self.assertIn("Host não autorizado", stderr.getvalue())
        submit_mock.assert_not_called()
        self.assertEqual(
            client.validate_base_url("https://example.invalid", allow_custom_host=True),
            "https://example.invalid",
        )

    def test_dry_run_does_not_submit_or_use_network(self) -> None:
        args = self.make_args(dry_run=True)
        stdout = io.StringIO()
        environment = {"COMFY_CLOUD_BASE_URL": "https://cloud.comfy.org"}

        with (
            patch.object(client, "parse_args", return_value=args),
            patch.object(client, "submit") as submit_mock,
            patch.dict(os.environ, environment, clear=False),
            redirect_stdout(stdout),
        ):
            result = client.main()

        self.assertEqual(result, 0)
        self.assertIn('"mode": "dry-run"', stdout.getvalue())
        submit_mock.assert_not_called()


if __name__ == "__main__":
    unittest.main()
