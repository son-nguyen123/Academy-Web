$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$launcherPath = Join-Path $PSScriptRoot "open-teacher-elearning.ps1"
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "AEC E-Learning - Teacher.lnk"
$powershellPath = Join-Path $PSHOME "powershell.exe"
$edgePath = Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powershellPath
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcherPath`""
$shortcut.WorkingDirectory = $projectRoot
$shortcut.Description = "Open the AEC E-Learning teacher workspace"
$shortcut.IconLocation = if (Test-Path $edgePath) { "$edgePath,0" } else { "$powershellPath,0" }
$shortcut.Save()

Write-Output $shortcutPath
