param(
  [string]$Output = "deploy.tar.gz"
)

$ErrorActionPreference = "Stop"

if (Test-Path $Output) {
  Remove-Item $Output -Force
}

$excludeArgs = @(
  "--exclude=.env",
  "--exclude=.env.local",
  "--exclude=.env.development",
  "--exclude=.env.production",
  "--exclude=.env.test",
  "--exclude=.env.*.local",
  "--exclude=node_modules",
  "--exclude=.next",
  "--exclude=dist",
  "--exclude=coverage",
  "--exclude=secrets",
  "--exclude=*.log",
  "--exclude=*.out",
  "--exclude=*.err",
  "--exclude=deploy.tar.gz"
)

& tar -czf $Output @excludeArgs .
if ($LASTEXITCODE -ne 0) {
  throw "failed to create archive"
}

$archiveList = & tar -tf $Output
if ($archiveList -match "^\./?\.env$" -or $archiveList -match "^\./?\.env\.(?!example$).+") {
  throw "archive contains .env files, aborting"
}

Write-Output "Created $Output without secret env files."
