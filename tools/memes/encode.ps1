# Makes the web copies of the memes in memess/ for /memes (public/memes/): 1080p H.264 videos with fast start (they
# play before they finish downloading), small poster pictures for the video cards, and small previews for the picture
# cards (the full pictures stay as they are, for download). Run again after adding memes: it skips what's already made.
#   powershell -ExecutionPolicy Bypass -File tools/memes/encode.ps1
$ErrorActionPreference = 'Continue'
$ff = (Get-Command ffmpeg -ErrorAction SilentlyContinue).Source
if (-not $ff) { $ff = Join-Path $PSScriptRoot '..\..\node_modules\@ffmpeg-installer\win32-x64\ffmpeg.exe' }
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$src = Join-Path $root 'memess'
$out = Join-Path $root 'public\memes'
foreach ($d in 'videos', 'posters', 'images', 'previews') { New-Item -ItemType Directory -Force (Join-Path $out $d) | Out-Null }

# original file -> web name (same names as src/memes/list.js)
$videos = [ordered]@{
  'Artificial_Girlfriend_Intelligence_-____clanktrade_RobinhoodCrypto_tcNdny.mp4' = 'clanktrade-robinhood'
  'Artificial_Girlfriend_Intelligence_-_1_000_Darlings_nusIf0.mp4' = '1000-darlings'
  'Artificial_Girlfriend_Intelligence_-_Everyone_s_feeling_the_AGI._Only_some_of_us_are_feeling_the_Artificia_rYdVhV.mp4' = 'feeling-the-agi'
  'Artificial_Girlfriend_Intelligence_-_i_love_AGI_slopcore_MiKohQ.mp4' = 'i-love-agi-slopcore'
  'Artificial_Girlfriend_Intelligence_-_I_m_your_AI_girlfriend_9cjX8y.mp4' = 'im-your-ai-girlfriend'
  'Artificial_Girlfriend_Intelligence_-_K4gxnv.mp4' = 'window-seat'
  'Artificial_Girlfriend_Intelligence_-_kicks_for_the_bears._kisses_for_the_holders_wbPb4Q.mp4' = 'kicks-for-the-bears'
  'Artificial_Girlfriend_Intelligence_-_Only_AGI_16kCq7.mp4' = 'only-agi'
  'Artificial_Girlfriend_Intelligence_-_PIVOT_TO_AGI_______________ONcVM5.mp4' = 'pivot-to-agi'
  'Artificial_Girlfriend_Intelligence_-_robinhood0xfa31d04462746aaa24bc7e5626403e09e4b106ec_is_the_first_A_gPTV3W.mp4' = 'first-on-robinhood'
  'Artificial_Girlfriend_Intelligence_-_we_taught_her_to_say_hello._the_trenches_taught_her_the_rest._hello_vIbVSJ.mp4' = 'the-trenches-taught-her'
  'Artificial_Girlfriend_Intelligence_-_We_ve_achieved_AGI_6eHVyl.mp4' = 'weve-achieved-agi'
  'Artificial_Girlfriend_Intelligence_-_yDEUEr.mp4' = 'look-back'
  'x-downloader.com_63DgjX.mp4' = 'subway-walk'
  'x-downloader.com_y0NIqz.mp4' = 'one-post'
}
$images = [ordered]@{
  'HTbmp66akAAz7of.jpg' = 'absolute-agi'; 'HThktCTbYAE772O.jpg' = 'psst'; 'HThxYhzaEAACDat.jpg' = 'all-in'
  'HTi8cgxagAARpfI.jpg' = 'the-plan'; 'HTix4BNbIAA3D44.jpg' = 'online'; 'HTjL7PPaYAA_O01.jpg' = 'approved'
  'HTnU2biacAES1pe.jpg' = 'off-on-a-trip'; 'HTtBlPMbwAA4Jtq.jpg' = 'the-agi-signal'; 'HTx15ZlbgAA7UlB.jpg' = 'one-more-message'
  'HU9FSASbsAAAkL-.jpg' = 'he-sees-her'; 'HUG3x7db0AAF0IU.jpg' = 'cooking'; 'HUrCH8UaAAAAq1H.jpg' = 'main-runner'
  'HUrEc1taIAAoCbO.jpg' = 'the-reveal'; 'HURgmMhboAAjivo.jpg' = 'im-flying'; 'HUZtVtVb0AEajbP.jpg' = 'im-super'
}

foreach ($k in $videos.Keys) {
  $in = Join-Path $src $k; $name = $videos[$k]
  $mp4 = Join-Path $out "videos\agi-$name.mp4"; $poster = Join-Path $out "posters\agi-$name.webp"
  if (-not (Test-Path $in)) { "missing $k"; continue }
  if (-not (Test-Path $poster)) {
    & $ff -v error -y -ss 2 -i $in -frames:v 1 -vf "scale='min(720,iw)':-2" -c:v libwebp -quality 78 $poster
    if (-not (Test-Path $poster) -or (Get-Item $poster).Length -eq 0) { & $ff -v error -y -i $in -frames:v 1 -vf "scale='min(720,iw)':-2" -c:v libwebp -quality 78 $poster }
  }
  if (Test-Path $mp4) { "skip $name"; continue }
  # long edits get a lower bitrate cap so they stay small; short clips keep more detail
  $dur = [double](& (Join-Path (Split-Path $ff) 'ffprobe.exe') -v error -show_entries format=duration -of csv=p=0 $in 2>$null)
  $cap = if ($dur -gt 120) { @('-maxrate', '2500k', '-bufsize', '5000k') } else { @('-maxrate', '6000k', '-bufsize', '12000k') }
  & $ff -v error -y -i $in -vf "scale='min(1920,iw)':-2" -c:v libx264 -preset medium -crf 22 @cap -pix_fmt yuv420p `
    -c:a aac -b:a 160k -movflags +faststart "$mp4.part.mp4"
  if ($LASTEXITCODE -eq 0) { Move-Item -Force "$mp4.part.mp4" $mp4; "done $name {0:N1}MB" -f ((Get-Item $mp4).Length / 1MB) } else { "FAILED $name" }
}

foreach ($k in $images.Keys) {
  $in = Join-Path $src $k; $name = $images[$k]
  $full = Join-Path $out "images\agi-$name.jpg"; $prev = Join-Path $out "previews\agi-$name.webp"
  if (-not (Test-Path $in)) { "missing $k"; continue }
  # the full picture for download: as it is, except the one 4096px picture, made 2048px
  if (-not (Test-Path $full)) {
    if ((Get-Item $in).Length -gt 1MB) { & $ff -v error -y -i $in -vf "scale='min(2048,iw)':-2" -q:v 3 $full } else { Copy-Item $in $full }
  }
  if (-not (Test-Path $prev)) { & $ff -v error -y -i $in -vf "scale='min(720,iw)':-2" -c:v libwebp -quality 80 $prev }
  "image $name"
}
"ALL DONE"
