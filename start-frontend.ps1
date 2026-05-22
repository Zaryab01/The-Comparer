# D:\Zaryab\Fragrance Comparer\start-frontend.ps1
$env:PATH = "$PSScriptRoot\frontend\node;$env:PATH"
Set-Location "$PSScriptRoot\frontend"
& ".\node\npm.cmd" run dev