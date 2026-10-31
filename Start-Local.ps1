$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
Set-Location -LiteralPath $taskRoot
if (-not (Test-Path -LiteralPath (Join-Path $taskRoot 'node_modules'))) {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed. See output above.' }
$taskNode = (Get-Command node).Source
New-Item -ItemType Directory -Force -Path (Join-Path $taskRoot '.local') | Out-Null
$taskRunning = $false
try {
    $taskResponse = Invoke-WebRequest -Uri 'http://127.0.0.1:4321/ru/' -UseBasicParsing -TimeoutSec 2
    $taskRunning = $taskResponse.StatusCode -eq 200
} catch {}
if (-not $taskRunning) {
    $taskProcess = Start-Process -FilePath $taskNode -ArgumentList @('scripts/astro.mjs','preview','--host','127.0.0.1','--port','4321') -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskRoot '.local/preview.log') -RedirectStandardError (Join-Path $taskRoot '.local/preview-error.log') -PassThru
    $taskProcess.Id | Set-Content -LiteralPath (Join-Path $taskRoot '.local/preview.pid')
}
$taskReady = $false
for ($taskAttempt = 0; $taskAttempt -lt 30; $taskAttempt++) {
    try {
        $taskResponse = Invoke-WebRequest -Uri 'http://127.0.0.1:4321/ru/' -UseBasicParsing -TimeoutSec 2
        if ($taskResponse.StatusCode -eq 200) { $taskReady = $true; break }
    } catch {}
    Start-Sleep -Milliseconds 500
}
if (-not $taskReady) { throw 'Site preview did not start. See .local/preview-error.log.' }
Write-Host 'Site: http://127.0.0.1:4321/ru/'
