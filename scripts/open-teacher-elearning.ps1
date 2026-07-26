$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$appUrl = "http://localhost:3000/api/elearning/demo-role"
$healthUrl = "http://localhost:3000/elearning"
$logDirectory = Join-Path $env:TEMP "AcademyWeb"
$stdoutLog = Join-Path $logDirectory "desktop-dev.out.log"
$stderrLog = Join-Path $logDirectory "desktop-dev.err.log"

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

function Test-AecElearning {
  try {
    $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 3
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

if (-not (Test-AecElearning)) {
  Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList @("run", "dev", "--", "-p", "3000") `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog

  $deadline = (Get-Date).AddSeconds(60)
  while ((Get-Date) -lt $deadline -and -not (Test-AecElearning)) {
    Start-Sleep -Milliseconds 750
  }
}

if (-not (Test-AecElearning)) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show(
    "AEC E-Learning could not start on port 3000.`nCheck $stderrLog for details.",
    "AEC E-Learning",
    "OK",
    "Error"
  ) | Out-Null
  exit 1
}

Start-Process $appUrl
