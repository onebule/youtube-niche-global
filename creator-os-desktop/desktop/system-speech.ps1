$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
$data = [Console]::In.ReadToEnd() | ConvertFrom-Json
Add-Type -AssemblyName System.Speech
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  if ($data.mode -eq 'voices') {
    $voices = @($speaker.GetInstalledVoices() | Where-Object { $_.Enabled } | ForEach-Object {
      @{ id = $_.VoiceInfo.Name; name = $_.VoiceInfo.Name; language = $_.VoiceInfo.Culture.Name }
    })
    ConvertTo-Json -InputObject $voices -Compress
  } elseif ($data.mode -eq 'synthesize') {
    $speaker.SelectVoice([string]$data.voice)
    $speaker.Rate = [int]$data.rate
    $speaker.SetOutputToWaveFile([string]$data.output)
    $speaker.Speak([System.IO.File]::ReadAllText([string]$data.source, [System.Text.Encoding]::UTF8))
  } else { throw 'Unsupported speech operation' }
} finally { $speaker.Dispose() }
