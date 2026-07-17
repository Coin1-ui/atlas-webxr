# Package models-api Lambda for upload (index.mjs + node_modules + package.json)
$ErrorActionPreference = "Stop"

# scripts/ -> models-api/
$root = Split-Path -Parent $PSScriptRoot
# models-api/ -> lambda/models-api-deploy.zip
$zipPath = Join-Path (Split-Path -Parent $root) "models-api-deploy.zip"

Set-Location $root

foreach ($required in @("index.mjs", "package.json")) {
  if (-not (Test-Path (Join-Path $root $required))) {
    Write-Error "Missing $required in $root"
  }
}

npm ci --omit=dev

Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
Compress-Archive -Path index.mjs, package.json, node_modules -DestinationPath $zipPath -CompressionLevel Optimal -Force

$item = Get-Item $zipPath
Write-Host "Created $($item.FullName) ($([math]::Round($item.Length / 1MB, 2)) MB)"
Write-Host "Handler: index.handler  |  Runtime: Node.js 18.x or 20.x"
