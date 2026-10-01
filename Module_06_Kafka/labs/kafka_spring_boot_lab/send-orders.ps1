# ---------------------------------------------------------------------------
#  send-orders.ps1 - posts every line of the CLI lab's orders.txt to the REST API
#
#  Each line is  customer:{"order":2001,"item":"keyboard","amount":45}
#  The customer becomes the message key, so the output shows which partition
#  each customer's orders land in.
#
#      powershell -ExecutionPolicy Bypass -File .\send-orders.ps1
# ---------------------------------------------------------------------------
param(
    [string]$File = (Join-Path $PSScriptRoot "..\kafka_cli_lab\lab\data\orders.txt"),
    [string]$Api  = "http://localhost:8090/api/orders"
)

Get-Content $File | Where-Object { $_ -match ':' } | ForEach-Object {
    $customer, $json = $_ -split ':', 2
    $body = $json | ConvertFrom-Json
    $body | Add-Member -NotePropertyName customer -NotePropertyValue $customer
    $r = Invoke-RestMethod -Method Post -Uri $Api -ContentType 'application/json' `
                           -Body ($body | ConvertTo-Json -Compress)
    '{0,-6} order {1}  ->  {2}-{3} @ offset {4}' -f $r.key, $r.value.order, $r.topic, $r.partition, $r.offset
}
