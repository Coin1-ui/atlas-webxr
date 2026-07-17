# Deploy models-api Lambda zip via AWS CLI (requires aws on PATH + credentials)
param(
  [Parameter(Mandatory = $true)]
  [string]$FunctionName,
  [string]$Region = "ap-south-1"
)

$ErrorActionPreference = "Stop"
$zipPath = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) "models-api-deploy.zip"

if (-not (Test-Path $zipPath)) {
  & (Join-Path $PSScriptRoot "package.ps1")
}

$aws = Get-Command aws -ErrorAction SilentlyContinue
if (-not $aws) {
  Write-Error "AWS CLI not found. Upload $zipPath manually in Lambda Console → Code → Upload from → .zip file"
}

aws lambda update-function-code `
  --region $Region `
  --function-name $FunctionName `
  --zip-file "fileb://$($zipPath -replace '\\','/')"

aws lambda wait function-updated --region $Region --function-name $FunctionName
Write-Host "Deployed $FunctionName in $Region"
