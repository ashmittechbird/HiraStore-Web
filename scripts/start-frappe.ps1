<#
.SYNOPSIS
  Start the local Frappe/ERPNext bench that backs the storefront.

.DESCRIPTION
  The bench lives in the Ubuntu-22.04 WSL distro at /home/frappe/frappe-bench.
  WSL has no systemd, so MariaDB and Redis are started as plain services before
  the web server. Nothing here persists across a Windows reboot, which is why
  this script exists.

  Serves on port 8001. Windows reaches it at http://localhost:8001 through WSL's
  localhost forwarding — do not address the VM by IP, WSL2 reassigns it on every
  restart.

.EXAMPLE
  .\scripts\start-frappe.ps1
  .\scripts\start-frappe.ps1 -Stop
#>
param(
    [switch]$Stop,
    [switch]$Status
)

$distro = 'Ubuntu-22.04'
$bench  = '/home/frappe/frappe-bench'

function Invoke-Wsl([string]$cmd) {
    wsl.exe -d $distro -u root -e bash -lc $cmd
}

if ($Stop) {
    Write-Host 'Stopping the bench...' -ForegroundColor Yellow
    Invoke-Wsl "pkill -f 'bench serve'; pkill -f 'frappe.app'; echo stopped"
    return
}

if ($Status) {
    $code = try {
        (Invoke-WebRequest -Uri 'http://localhost:8001/api/method/ping' -TimeoutSec 8 -UseBasicParsing).StatusCode
    } catch { 0 }
    if ($code -eq 200) { Write-Host 'Frappe is up on http://localhost:8001' -ForegroundColor Green }
    else               { Write-Host 'Frappe is not responding' -ForegroundColor Red }
    return
}

Write-Host 'Starting MariaDB and Redis...' -ForegroundColor Cyan
Invoke-Wsl 'service mariadb start >/dev/null 2>&1; service redis-server start >/dev/null 2>&1 || redis-server --daemonize yes; sleep 4; echo services up'

Write-Host 'Starting the Frappe web server on port 8001...' -ForegroundColor Cyan
Invoke-Wsl "pkill -f 'bench serve' 2>/dev/null; sleep 2; su - frappe -c 'cd $bench && nohup bench serve --port 8001 > /home/frappe/serve.log 2>&1 &'; echo launched"

Write-Host 'Waiting for it to answer...' -ForegroundColor Cyan
$ok = $false
foreach ($i in 1..20) {
    Start-Sleep -Seconds 2
    try {
        if ((Invoke-WebRequest -Uri 'http://localhost:8001/api/method/ping' -TimeoutSec 5 -UseBasicParsing).StatusCode -eq 200) {
            $ok = $true; break
        }
    } catch { }
}

if ($ok) {
    Write-Host ''
    Write-Host '  Frappe is up.' -ForegroundColor Green
    Write-Host '    Desk       http://localhost:5173/app        (Administrator / admin)'
    Write-Host '    Storefront http://localhost:5173/store/     (npm run dev)'
    Write-Host ''
    Write-Host '  Leave this window alone; closing WSL entirely stops the bench.' -ForegroundColor DarkGray
} else {
    Write-Host 'Frappe did not come up. Check the log with:' -ForegroundColor Red
    Write-Host "  wsl -d $distro -u root -e tail -40 /home/frappe/serve.log"
}
