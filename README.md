# Sessiz Blok

**English** | [Türkçe](README.tr.md)

A lightweight Chrome ad blocker (Manifest V3) focused on popups, pop-unders and video ads. The name means "silent block" in Turkish.

## Features

- **Popup and pop-under blocking:** Stops windows opened without a user click, and invisible full-page click traps.
- **Tab-under protection:** Cancels the redirect of the original page to an ad right after a new tab is opened.
- **Video ads:** Skips or speeds through ads on YouTube.
- **Filter lists:** Network and cosmetic filtering with EasyList, EasyPrivacy, uBlock filters and Peter Lowe's list.
- **Anti-adblock countermeasures:** Answers simple detection probes with harmless stand-ins.
- **Per-site toggle:** Turn the extension off on any site with one click.
- **Automatic updates:** Filter lists refresh themselves once a week.

## Installation

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the project folder.

About a minute after installation the extension downloads the filter lists on its own. You can check the status in the popup under "Listeleri şimdi güncelle" (update lists now).

## Larger rule set (optional)

Chrome allows at most 25,000 rules from the automatic update. For broader coverage you can compile the lists ahead of time:

```bash
python3 build_lists.py
```

The script downloads the lists into `lists/`, generates `list_*.json` and `cosmetic.json`, and updates `manifest.json`. Then reload the extension on `chrome://extensions`.

> **Note:** `build_lists.py` modifies `manifest.json`. Run `git checkout manifest.json` before committing. The generated list files are excluded by `.gitignore` because they are derived from other people's licensed lists.

Without an internet connection, put the `.txt` list files into `lists/` by hand and run `python3 build_lists.py --only-local`.

## Project structure

| File | Purpose |
|---|---|
| `manifest.json` | Extension definition |
| `rules.json` | Core blocking rules and script stand-ins |
| `scriptlets.js` | Runs in the page context: popups, tab-under, YouTube, anti-adblock |
| `content.js` | Cosmetic hiding and YouTube ad skipping |
| `background.js` | Serves cosmetic data, automatic updates |
| `lists.js` | Converts filter lists into Chrome rules |
| `common.js` | On/off switch and site exceptions |
| `popup.*` | User interface |
| `stubs/` | Harmless stand-in scripts for anti-adblock probes |
| `build_lists.py` | Tool for precompiling the larger rule set |

## Privacy

The extension does not collect or transmit any user data. Its only network requests download filter lists from these hosts: `easylist.to`, `ublockorigin.github.io` and `pgl.yoyo.org`. All settings and lists are stored locally in the browser.

## Known limitations

- Because of Manifest V3 restrictions it is not as comprehensive as uBlock Origin. Options such as `$csp`, `$redirect` and `$removeparam`, and regex filters, are skipped.
- The YouTube methods change on Google's side often and may break from time to time.
- Some sites can detect ad blockers. There is no protection against every detection method.
- Tab-under protection is heuristic and may occasionally block a legitimate redirect. If you have trouble on a site, turn the extension off for it from the popup.

## Reporting issues

If an ad slips through or a page breaks, open an issue with the site's address and the red (blocked) rows from the F12 > Network tab.

## License

MIT. See the `LICENSE` file for details.
