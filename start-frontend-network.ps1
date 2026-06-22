# start-frontend-network.ps1
# Runs the Vite dev server bound to ALL network interfaces so other devices
# on your LAN (phones, other PCs) can open the app at http://<this-pc-ip>:5173
#
# Notes:
#   - Keep the backend running too (start-backend.ps1). Vite proxies /api to
#     http://localhost:8000 on THIS machine, so the backend stays on localhost.
#   - First run: Windows Firewall may pop up asking to allow Node.js — click
#     "Allow access" for Private networks so other devices can reach it.

$env:PATH = "$PSScriptRoot\frontend\node;$env:PATH"
Set-Location "$PSScriptRoot\frontend"

# Print the LAN URL(s) for convenience
try {
    $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
        Where-Object {
            $_.IPAddress -notlike '127.*' -and
            $_.IPAddress -notlike '169.254.*'
        } |
        Select-Object -ExpandProperty IPAddress
} catch {
    $ips = @()
}

Write-Host ""
Write-Host "Sharing the frontend on your network. Others can open:" -ForegroundColor Cyan
if ($ips.Count -gt 0) {
    foreach ($ip in $ips) { Write-Host "    http://$($ip):5173" -ForegroundColor Green }
} else {
    Write-Host "    http://<your-ip>:5173   (run 'ipconfig' to find your IPv4 address)" -ForegroundColor Yellow
}
Write-Host "Make sure start-backend.ps1 is also running." -ForegroundColor DarkGray
Write-Host ""

# --host binds 0.0.0.0 (all interfaces); Vite also prints its own Network URL.
& ".\node\npm.cmd" run dev -- --host
