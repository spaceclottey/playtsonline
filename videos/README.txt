Tethersnipe — Video File Naming Convention
==========================================

Video files must be named exactly as the scene ID with a .mp4 extension.

Scene IDs and their filenames:

  start.mp4
  cup.mp4
  paperTowel.mp4
  NikoActsAsLucia.mp4
  AngieActsAsLucia.mp4
  giveCigarrette.mp4
  dontGiveCigarrette.mp4
  canon.mp4
  dontPlayWithLucia_speedrun.mp4
  accept.mp4
  reject.mp4
  accept_speedrun.mp4
  reject_speedrun.mp4
  speakWithAngie.mp4
  playWithLucia.mp4
  playWithLucia_speedrun.mp4
  failBlackmail.mp4
  winBlackmail_destruction.mp4
  failManipulate_racism.mp4
  winManipulate_platonic.mp4
  dontSpeakWithAngie_dropout.mp4
  god.mp4
  heist.mp4

Special files:
  trailer.mp4    — used by the TRAILER menu button
  credits.mp4    — reserved for end credits (not currently wired, TEXT credits
                   are in index.html #credits-section)

Hosting
-------
Videos are NOT committed to this repository. They are served from an external
CDN. Set the VIDEO_BASE_URL variable in js/player.js to your CDN base URL.

Default (GitHub Releases):
  Upload your MP4s to a GitHub Release tagged "videos".
  Set VIDEO_BASE_URL = 'https://github.com/YOUR-USERNAME/tethersnipe/releases/download/videos/'

To switch to any other host (Cloudflare R2, S3, etc.), only that one line
needs to change.

Format recommendations
----------------------
- Container: MP4 (H.264 video, AAC audio)
- Resolution: 1280×720 or 1920×1080
- For unfilmed choice thumbnails: short looping clips, place in
  assets/thumbnails/ as [sceneId]_loop.mp4
