@echo off & setlocal
rem ====================================================================
rem  ScrollHub - Add Game tool (double-click to run on Windows)
rem  Enter a game link (https or GitHub), a name, and optionally a
rem  picture (image URL or a file on your computer). It adds the game
rem  to your live site instantly.
rem ====================================================================
set "SELF=%~f0"
set "SELFDIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=[IO.File]::ReadAllText($env:SELF); $m='#PS'+'_BEGIN#'; $i=$s.IndexOf($m); if($i -lt 0){Write-Host 'marker missing'; exit 1}; Invoke-Expression $s.Substring($i+$m.Length)"
exit /b %errorlevel%

#PS_BEGIN#
$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

function Prop($o,$n,$d){ if($o -and ($o.PSObject.Properties.Name -contains $n)){ return $o.$n } return $d }
function ServerError($e){
  $msg = $e.Exception.Message
  if($e.ErrorDetails -and $e.ErrorDetails.Message){
    try { $j = $e.ErrorDetails.Message | ConvertFrom-Json; if($j.error){ $msg = $j.error } } catch {}
  }
  return $msg
}

$cfgDir = $env:SELFDIR; if(-not $cfgDir){ $cfgDir = (Get-Location).Path }
$cfgFile = Join-Path $cfgDir 'scrollhub-addgame.json'
$cfg = $null
if(Test-Path $cfgFile){ try { $cfg = Get-Content $cfgFile -Raw | ConvertFrom-Json } catch { $cfg = $null } }

Write-Host ''
Write-Host '  ===============================' -ForegroundColor Cyan
Write-Host '     ScrollHub  -  Add a Game' -ForegroundColor Cyan
Write-Host '  ===============================' -ForegroundColor Cyan
Write-Host ''

$base = Prop $cfg 'base' 'https://scrollhub-acvy.onrender.com'
$inp = Read-Host "Site URL [$base]"
if($inp){ $base = $inp.Trim() }
$base = $base.TrimEnd('/')

$pw = Prop $cfg 'password' ''
if($pw){
  $u = Read-Host 'Admin password is saved. Press Enter to use it, or type a new one'
  if($u){ $pw = $u }
} else {
  $pw = Read-Host 'Admin password'
}
if(-not $pw){ Write-Host 'No password given - cannot add games.' -ForegroundColor Red; Read-Host 'Press Enter to close'; exit }

$ctmap = @{ 'png'='image/png'; 'jpg'='image/jpeg'; 'jpeg'='image/jpeg'; 'webp'='image/webp'; 'gif'='image/gif' }

function ListGames($base, $pw){
  try {
    $r = Invoke-RestMethod -Method Get -Uri "$base/api/games/catalog" -ErrorAction Stop
    $games = @($r | Where-Object { $_.isGlobal -eq $true })
    if($games.Count -eq 0){ Write-Host '  No custom games found.' -ForegroundColor Yellow; return $null }
    Write-Host ''
    Write-Host '  Your custom games:' -ForegroundColor Cyan
    for($i=0; $i -lt $games.Count; $i++){
      Write-Host ("  [{0}] {1}  (id: {2})" -f ($i+1), $games[$i].label, $games[$i].id) -ForegroundColor White
    }
    return $games
  } catch { Write-Host "  Could not fetch games: $(ServerError $_)" -ForegroundColor Red; return $null }
}

do {
  Write-Host ''
  Write-Host '--------------------------------------' -ForegroundColor DarkGray
  Write-Host '  [A] Add a game    [R] Remove a game    [Q] Quit' -ForegroundColor Cyan
  $choice = (Read-Host 'Choose').Trim().ToUpper()
  if($choice -eq 'Q' -or $choice -eq ''){ break }

  if($choice -eq 'R'){
    $games = ListGames $base $pw
    if(-not $games){ $again = 'y'; continue }
    $sel = Read-Host 'Enter number to remove (or Enter to cancel)'
    if(-not $sel){ $again = 'y'; continue }
    $idx = [int]$sel - 1
    if($idx -lt 0 -or $idx -ge $games.Count){ Write-Host '  Invalid number.' -ForegroundColor Red; $again = 'y'; continue }
    $g = $games[$idx]
    $confirm = Read-Host "Remove '$($g.label)'? (y/N)"
    if($confirm -notmatch '^[Yy]'){ Write-Host '  Cancelled.' -ForegroundColor DarkGray; $again = 'y'; continue }
    try {
      $payload = @{ password=$pw; action='delgame'; id=$g.id } | ConvertTo-Json -Compress
      $r = Invoke-RestMethod -Method Post -Uri "$base/api/admin" -ContentType 'application/json' -Body $payload
      if($r.ok){ Write-Host "  Removed '$($g.label)'." -ForegroundColor Green }
      else { Write-Host "  Failed: $($r.error)" -ForegroundColor Red }
    } catch { Write-Host "  Error: $(ServerError $_)" -ForegroundColor Red }
    $again = 'y'; continue
  }

  if($choice -ne 'A'){ $again = 'y'; continue }

  $link = Read-Host 'Game link  (https://...  or  github.com/user/repo)'
  if(-not $link){ $again = 'y'; continue }
  $link = $link.Trim()

  if($link -match '^(https?://)?github\.com/([^/]+)/([^/?#]+)'){
    $user = $matches[2]; $repo = ($matches[3] -replace '\.git$','')
    $pages = "https://$user.github.io/$repo/"
    Write-Host "GitHub repo detected. Games usually run from GitHub Pages:" -ForegroundColor Yellow
    $c = Read-Host "Use  $pages  ?  (Enter = yes, or paste the real play URL)"
    if($c){ $link = $c.Trim() } else { $link = $pages }
  }
  if($link -notmatch '^https?://'){ Write-Host 'Link must start with http:// or https://' -ForegroundColor Red; $again = Read-Host 'Try again? (y/N)'; continue }

  $name = Read-Host 'Game name'
  if(-not $name){ Write-Host 'A name is required.' -ForegroundColor Red; $again = Read-Host 'Try again? (y/N)'; continue }
  $cat = Read-Host 'Category (optional - e.g. Arcade, Racing, Shooting)'

  Write-Host ''
  Write-Host 'Picture:   [1] Image URL      [2] Image file on this PC      [3] None'
  $pc = Read-Host 'Choose 1 / 2 / 3'
  $imageUrl = ''
  if($pc -eq '1'){
    $imageUrl = (Read-Host 'Image URL').Trim()
  } elseif($pc -eq '2'){
    $fp = (Read-Host 'Path to image file (you can drag the file onto this window)').Trim().Trim('"')
    if(Test-Path -LiteralPath $fp){
      try {
        $bytes = [IO.File]::ReadAllBytes($fp)
        $ext = ([IO.Path]::GetExtension($fp)).TrimStart('.').ToLower()
        $ct = $ctmap[$ext]; if(-not $ct){ $ct = 'image/png' }
        $dataUrl = "data:$ct;base64," + [Convert]::ToBase64String($bytes)
        $body = @{ password=$pw; dataUrl=$dataUrl } | ConvertTo-Json -Compress
        $up = Invoke-RestMethod -Method Post -Uri "$base/api/admin/gameimg" -ContentType 'application/json' -Body $body
        if($up.ok){ $imageUrl = $up.url; Write-Host "  Picture uploaded." -ForegroundColor Green }
        else { Write-Host "  Upload failed: $($up.error)" -ForegroundColor Red }
      } catch { Write-Host "  Upload error: $(ServerError $_)" -ForegroundColor Red }
    } else { Write-Host '  File not found - adding the game without a picture.' -ForegroundColor Red }
  }

  $gameUrl = '/extframe.html?url=' + [uri]::EscapeDataString($link)
  $payload = @{ password=$pw; action='addgame'; label=$name; url=$gameUrl; category=$cat }
  if($imageUrl){ $payload['imageUrl'] = $imageUrl }

  try {
    $r = Invoke-RestMethod -Method Post -Uri "$base/api/admin" -ContentType 'application/json' -Body ($payload | ConvertTo-Json -Compress)
    if($r.ok){
      Write-Host ''
      Write-Host "  SUCCESS - '$name' added!" -ForegroundColor Green
      Write-Host "  Open your site's Games page and refresh to see it." -ForegroundColor Green
      Write-Host "  (If it opens to a blank screen, that game blocks embedding - try its direct play link.)" -ForegroundColor DarkGray
    } else {
      Write-Host "  Failed: $($r.error)" -ForegroundColor Red
    }
  } catch { Write-Host "  Error: $(ServerError $_)" -ForegroundColor Red }

  $again = 'y'
} while ($again -match '^[Yy]')

Write-Host ''
$save = Read-Host 'Save the site URL + password in this folder so you skip typing next time? (y/N)'
if($save -match '^[Yy]'){
  try {
    @{ base=$base; password=$pw } | ConvertTo-Json | Set-Content -LiteralPath $cfgFile -Encoding UTF8
    Write-Host "Saved to $cfgFile  -  keep this file private (it holds your admin password)." -ForegroundColor Yellow
  } catch { Write-Host "Could not save config: $($_.Exception.Message)" -ForegroundColor Red }
}
Write-Host ''
Read-Host 'All done. Press Enter to close'
