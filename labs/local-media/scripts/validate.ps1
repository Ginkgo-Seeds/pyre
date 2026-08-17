$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
python -m unittest discover -s (Join-Path $projectRoot 'tests') -p 'test_*.py'
python (Join-Path $projectRoot 'tests\validate_workflows.py')
python (Join-Path $projectRoot 'api\submit_comfy_cloud.py') --dry-run
