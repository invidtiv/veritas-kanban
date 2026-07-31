param(
  [string]$BaseUrl = $(if ($env:VK_API_URL) { $env:VK_API_URL } else { 'http://100.115.155.120:3001' }),
  [string]$AgentId = $env:VK_AGENT_ID,
  [string]$ApiKey = $env:VK_API_KEY
)

$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')

if (-not $ApiKey -and $AgentId) {
  $SecureKey = Read-Host "VK key for $AgentId" -AsSecureString
  $KeyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureKey)
  try { $ApiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($KeyPointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($KeyPointer) }
}

if (Get-Command tailscale -ErrorAction SilentlyContinue) {
  & tailscale status *> $null
  if ($LASTEXITCODE -ne 0) { throw 'Tailscale is installed but not connected.' }
}

Invoke-RestMethod "$BaseUrl/health" | Out-Null

$BinDir = Join-Path $HOME '.local\bin'
$VkPath = Join-Path $BinDir 'vk.exe'
New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
Invoke-WebRequest "$BaseUrl/remote-agent/bin/vk-windows-x64.exe" -OutFile "$VkPath.tmp"
$ChecksumPath = Join-Path $BinDir 'SHA256SUMS.tmp'
Invoke-WebRequest "$BaseUrl/remote-agent/bin/SHA256SUMS" -OutFile $ChecksumPath
$ChecksumLine = Select-String -Path $ChecksumPath -Pattern '^([A-Fa-f0-9]{64})\s+\*?vk-windows-x64\.exe$'
Remove-Item $ChecksumPath
if (-not $ChecksumLine) { Remove-Item "$VkPath.tmp"; throw 'Windows VK checksum is missing.' }
$ExpectedHash = $ChecksumLine.Matches[0].Groups[1].Value
$ActualHash = (Get-FileHash "$VkPath.tmp" -Algorithm SHA256).Hash
if ($ExpectedHash -ine $ActualHash) {
  Remove-Item "$VkPath.tmp"
  throw 'VK binary checksum verification failed.'
}
Move-Item "$VkPath.tmp" $VkPath -Force

$UserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (($UserPath -split ';') -notcontains $BinDir) {
  $NewPath = if ($UserPath) { "$BinDir;$UserPath" } else { $BinDir }
  [Environment]::SetEnvironmentVariable('Path', $NewPath, 'User')
}
if (($env:Path -split ';') -notcontains $BinDir) { $env:Path = "$BinDir;$env:Path" }

$SkillRoots = @(
  (Join-Path $HOME '.codex\skills\veritas-kanban'),
  (Join-Path $HOME '.agents\skills\veritas-kanban')
)
foreach ($Root in $SkillRoots) {
  New-Item -ItemType Directory -Path (Join-Path $Root 'agents') -Force | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $Root 'references') -Force | Out-Null
  Invoke-WebRequest "$BaseUrl/remote-agent/skill/veritas-kanban/SKILL.md" -OutFile (Join-Path $Root 'SKILL.md')
  Invoke-WebRequest "$BaseUrl/remote-agent/skill/veritas-kanban/agents/openai.yaml" -OutFile (Join-Path $Root 'agents\openai.yaml')
  Invoke-WebRequest "$BaseUrl/remote-agent/skill/veritas-kanban/references/cli.md" -OutFile (Join-Path $Root 'references\cli.md')
}

& $VkPath --version | Out-Null

if ($ApiKey) {
  if (-not $AgentId) { throw 'Provide -AgentId when configuring a key.' }
  & $VkPath connect $BaseUrl --key $ApiKey --name $AgentId
  $ConfigPath = Join-Path $env:APPDATA 'veritas-kanban\config.json'
  if (Test-Path $ConfigPath) {
    & icacls.exe $ConfigPath '/inheritance:r' "/grant:r" "${env:USERNAME}:(F)" *> $null
  }
  $PreviousAdminKey = $env:VERITAS_ADMIN_KEY
  $PreviousApiUrl = $env:VK_API_URL
  try {
    $env:VERITAS_ADMIN_KEY = ''
    $env:VK_API_URL = $BaseUrl
    $env:VK_API_KEY = $ApiKey
    & $VkPath summary | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'VK authentication smoke test failed.' }
  } finally {
    if ($null -eq $PreviousAdminKey) { Remove-Item Env:VERITAS_ADMIN_KEY -ErrorAction SilentlyContinue } else { $env:VERITAS_ADMIN_KEY = $PreviousAdminKey }
    if ($null -eq $PreviousApiUrl) { Remove-Item Env:VK_API_URL -ErrorAction SilentlyContinue } else { $env:VK_API_URL = $PreviousApiUrl }
  }
  Write-Host "VK installed and connected as $AgentId. Run: vk status"
} else {
  Write-Host "VK and its agent skill are installed. Request a scoped key, then follow $BaseUrl/llms.txt"
}

$ApiKey = $null
Remove-Item Env:VK_API_KEY -ErrorAction SilentlyContinue
