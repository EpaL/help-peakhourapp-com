---
name: cleanshot
description: >-
  Drive CleanShot X on macOS via its cleanshot:// URL scheme to capture
  screenshots, record the screen, run OCR, annotate, and pin images. Use when
  the user asks to take/capture a screenshot, grab a region or window, record
  the screen, extract text from the screen (OCR), or land a fresh capture into a
  docs image folder. macOS only; requires CleanShot X to be installed.
---

# CleanShot X

Control CleanShot X by opening `cleanshot://` URLs. Every command is invoked the
same way:

```bash
open "cleanshot://command-name?param1=value1&param2=value2"
```

`open` returns immediately — it hands the URL to CleanShot and exits. The capture
UI (or the saved file) appears asynchronously, so when a capture writes a file,
poll for that file rather than assuming it exists the instant `open` returns.

Reference: https://cleanshot.com/docs-api

## The `action` parameter

Most screenshot commands accept `action`, which decides what happens after the
shot is taken:

| `action` | Result |
|----------|--------|
| `copy` | Copies the image to the clipboard. |
| `save` | Saves to CleanShot's configured save location. |
| `annotate` | Opens the capture in the annotation tool. |
| `upload` | Uploads to CleanShot Cloud. |
| `pin` | Pins the capture as a floating overlay. |

If `action` is omitted, CleanShot uses its default post-capture behaviour from
Settings.

## Commands

### Screenshots
| Command | Parameters | Does |
|---------|-----------|------|
| `capture-area` | `x`, `y`, `width`, `height`, `display`, `action` | Area capture. With no geometry it opens the interactive crosshair; with geometry it captures that exact rect. |
| `capture-previous-area` | `action` | Repeats the last area capture — same rect, no UI. |
| `capture-fullscreen` | `action` | Captures the whole screen. |
| `capture-window` | `action` | Opens window-picker capture. |
| `self-timer` | `action` | Capture after the configured self-timer delay. |
| `scrolling-capture` | `x`, `y`, `width`, `height`, `display`, `start` (true/false), `autoscroll` (true/false) | Scrolling capture. `start=true` begins immediately; `autoscroll=true` scrolls automatically. |
| `pin` | `filepath` (PNG/JPEG) | Pins an existing image file as a floating overlay. |

`x`/`y`/`width`/`height` are in points; `display` selects the screen (1-based).
Geometry parameters on these commands need CleanShot **v4.7+**.

### Screen recording
| Command | Parameters | Does |
|---------|-----------|------|
| `record-screen` | `x`, `y`, `width`, `height`, `display` | Opens recording mode (optionally pre-framed to a rect). |

### OCR / text recognition
| Command | Parameters | Does |
|---------|-----------|------|
| `capture-text` | `filepath`, `x`, `y`, `width`, `height`, `display`, `linebreaks` (true/false) | Extracts text. With `filepath` it OCRs that image; otherwise opens the on-screen OCR tool. `linebreaks=false` strips line breaks from the result. |

### Annotation
| Command | Parameters | Does |
|---------|-----------|------|
| `open-annotate` | `filepath` (PNG/JPEG) | Opens a file in the annotation tool. |
| `open-from-clipboard` | — | Opens the current clipboard image in the annotation tool. |

### All-in-one
| Command | Parameters | Does |
|---------|-----------|------|
| `all-in-one` | `x`, `y`, `width`, `height`, `display` | Launches all-in-one capture mode. |

### Quick Access overlay & history
| Command | Parameters | Does |
|---------|-----------|------|
| `add-quick-access-overlay` | `filepath` (required; PNG/JPEG/MP4) | Adds a file to the Quick Access overlay. |
| `open-history` | — | Opens capture history. |
| `restore-recently-closed` | — | Restores the most recently closed capture. |

### Desktop icons & settings
| Command | Parameters | Does |
|---------|-----------|------|
| `toggle-desktop-icons` / `hide-desktop-icons` / `show-desktop-icons` | — | Control desktop icon visibility — handy for clean screenshots. |
| `open-settings` | `tab` (`general`, `wallpaper`, `shortcuts`, `quickaccess`, `recording`, `screenshots`, `annotate`, `cloud`, `advanced`, `about`) | Opens Settings to a tab. |

## Recipes

### Interactive capture, saved to a known place
CleanShot's `save` action writes to *its own* configured save location, which is
stored as a security-scoped bookmark and isn't readable from the command line.
To reliably land a capture at a specific path, capture to the clipboard and write
that out yourself. Trigger the crosshair and wait for the user to drag a region:

```bash
open "cleanshot://capture-area?action=copy"
```

Then write the clipboard PNG to a file (no extra tools required):

```bash
osascript -e 'set p to POSIX file "/abs/path/out.png"' \
  -e 'set d to (the clipboard as «class PNGf»)' \
  -e 'set fh to open for access p with write permission' \
  -e 'set eof fh to 0' \
  -e 'write d to fh' \
  -e 'close access fh'
```

If `pngpaste` is installed, `pngpaste /abs/path/out.png` is simpler.

### Capture straight into a docs image folder
This repo's screenshots live next to each page in a `*-images/` folder (see
`AGENTS`/memory note on image sizing). To grab a new one:

1. Decide the target path, e.g.
   `src/content/docs/user-guide/history-view-images/history-view-toolbar.png`.
2. Run `open "cleanshot://capture-area?action=copy"` and let the user select the region.
3. Write the clipboard to that path with the `osascript` snippet above.
4. Reference it in the `.mdx` with a sizing wrapper:
   ```mdx
   <div class="img-lg">

   ![Descriptive alt text](./history-view-images/history-view-toolbar.png)

   </div>
   ```

### Clean shots
Hide desktop clutter before a fullscreen or window grab:

```bash
open "cleanshot://hide-desktop-icons"
open "cleanshot://capture-window?action=copy"
open "cleanshot://show-desktop-icons"
```

### OCR text off the screen
```bash
open "cleanshot://capture-text?linebreaks=true"
```
Then read the result from the clipboard (`pbpaste`).

## Notes & gotchas
- **macOS only.** Verify CleanShot X is installed (`ls /Applications | grep -i cleanshot`) before relying on these commands.
- `open` does not block. For any file-producing capture, poll for the file (e.g. with a short `until [ -f "$path" ]` loop) instead of reading it immediately.
- Interactive captures (no geometry) need the user to act on screen — tell them what to select and don't assume non-interactive completion.
- Quote the whole URL in the shell; `&` between parameters will otherwise background the command.
- Version floors: most commands need v3.5.1+, OCR/annotate need v3.8.1+, geometry parameters need v4.7+.
