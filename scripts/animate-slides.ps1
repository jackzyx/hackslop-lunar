param([string]$Deck = 'docs/slides-v1.pptx')
$ErrorActionPreference = 'Stop'
$deckPath = (Resolve-Path -LiteralPath $Deck).Path
$previewPath = Join-Path (Split-Path $deckPath) 'slide-preview'
New-Item -ItemType Directory -Force -Path $previewPath | Out-Null
$powerpoint = New-Object -ComObject PowerPoint.Application
try {
    $presentation = $powerpoint.Presentations.Open($deckPath, 0, 0, 0)
    $report = @()
    foreach ($slide in $presentation.Slides) {
        $transition = $slide.SlideShowTransition
        $transition.EntryEffect = 3849 # ppEffectFadeSmoothly
        $transition.Duration = 0.4
        $transition.AdvanceOnClick = -1
        $transition.AdvanceOnTime = 0
        $sequence = $slide.TimeLine.MainSequence
        while ($sequence.Count -gt 0) { $sequence.Item(1).Delete() }
        # Leave titles, attribution, mock-data notices and the mapping table visible.
        # Body content fades in automatically; slide 2 has one deliberate comparison reveal.
        $rightReveal = $false
        if ($slide.SlideIndex -ne 8) {
            foreach ($shape in $slide.Shapes) {
                if ($shape.HasTextFrame -ne -1) { continue }
                $text = $shape.TextFrame.TextRange.Text
                if ($shape.Top -lt 110 -or $shape.Top -gt 475 -or $shape.Height -lt 26) { continue }
                if ($text -match '^NASA Space Apps|mock scenario|^Screen schematic') { continue }
                $trigger = 2 # WithPrevious: begin automatically on slide entry.
                $delay = 0.15
                if ($slide.SlideIndex -eq 2 -and $shape.Left -gt 450) {
                    if (-not $rightReveal) { $trigger = 1; $rightReveal = $true } # OnPageClick
                    $delay = 0
                } elseif ($shape.Top -gt 290) { $delay = 0.35 }
                $effect = $sequence.AddEffect($shape, 10, 0, $trigger) # msoAnimEffectFade
                $effect.Timing.Duration = 0.3
                $effect.Timing.TriggerDelayTime = [single]$delay
            }
        }
        $report += [pscustomobject]@{ Slide=$slide.SlideIndex; Transition=$transition.EntryEffect; Duration=$transition.Duration; Animations=$sequence.Count; AutoAdvance=[bool]$transition.AdvanceOnTime }
    }
    $presentation.Save()
    $presentation.Close()
    # Reopen the saved file so validation checks persistence, not only in-memory COM state.
    $presentation = $powerpoint.Presentations.Open($deckPath, -1, 0, 0)
    if ($presentation.Slides.Count -ne 8) { throw 'Expected exactly 8 slides' }
    foreach ($slide in $presentation.Slides) {
        if ($slide.SlideShowTransition.EntryEffect -ne 3849) { throw 'Fade transition missing' }
        if ($slide.SlideIndex -ne 8 -and $slide.TimeLine.MainSequence.Count -eq 0) { throw 'Animation missing' }
    }
    $presentation.Export($previewPath, 'PNG', 1600, 900)
    $presentation.Close()
    $report | ConvertTo-Json | Set-Content -LiteralPath (Join-Path (Split-Path $deckPath) 'slide-motion-report.json') -Encoding UTF8
    $report | Format-Table -AutoSize
} finally {
    $powerpoint.Quit()
}
