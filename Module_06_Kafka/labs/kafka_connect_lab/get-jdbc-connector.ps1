# ---------------------------------------------------------------------------
#  get-jdbc-connector.ps1 - installs Confluent's JDBC connector into .\plugins
#
#  Free to use under the Confluent Community License; it bundles the JDBC
#  drivers for PostgreSQL and other databases.  Source: Confluent Hub.
#
#      powershell -ExecutionPolicy Bypass -File .\get-jdbc-connector.ps1
#      docker compose restart connect1        # workers scan plugin.path at startup
# ---------------------------------------------------------------------------
param([string]$Version = "10.9.9")

$name = "confluentinc-kafka-connect-jdbc-$Version"
$url  = "https://hub-downloads.confluent.io/api/plugins/confluentinc/kafka-connect-jdbc/versions/$Version/$name.zip"
$dir  = Join-Path $PSScriptRoot "plugins"
$zip  = Join-Path $env:TEMP "$name.zip"

if (Test-Path (Join-Path $dir $name)) { "Already installed: plugins\$name"; exit 0 }
New-Item -ItemType Directory -Force $dir | Out-Null
"Downloading $url"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
Expand-Archive -Path $zip -DestinationPath $dir -Force
Remove-Item $zip
"Installed: plugins\$name"
Get-ChildItem (Join-Path $dir "$name\lib") -Filter *.jar | Select-Object Name, @{n='KB'; e={[int]($_.Length / 1KB)}}
