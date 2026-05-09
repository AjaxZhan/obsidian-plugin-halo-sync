# Halo Publisher Obsidian Plugin

Publish Obsidian notes directly to your [Halo](https://halo.run) blog.

## Features

- **One-click publish** — create or update Halo posts without leaving Obsidian
- **Automatic image upload** — local images are uploaded to Halo and replaced with permalinks
- **Metadata persistence** — title, slug, categories, tags and cover are saved to frontmatter after first publish
- **Zero-friction updates** — subsequent edits read metadata from frontmatter and publish immediately
- **Category selection** — fetches and displays your Halo categories in a multi-select checklist
- **Auto-generated slugs** — unique hash slugs generated automatically, editable if needed
- **Dual image syntax** — supports both standard Markdown `![alt](path)` and Obsidian WikiLinks `![[image.png]]`

## Requirements

- Obsidian Desktop (macOS / Windows / Linux)
- Halo 2.24+ with a Personal Access Token (PAT)

## Installation

### From Release

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/ajaxzhan/obsidian-halo-publisher/releases).
2. Copy them into `{your-vault}/.obsidian/plugins/halo-publisher/`.
3. Restart Obsidian, go to **Settings → Community Plugins**, disable Safe Mode and enable **Halo Publisher**.

### From Source

```bash
git clone https://github.com/ajaxzhan/obsidian-halo-publisher.git
cd obsidian-halo-publisher
npm install
npm run build
```

Then copy `main.js`, `manifest.json`, and `styles.css` to your vault's plugin directory.

## Configuration

Open **Settings → Halo Publisher** and fill in:

| Setting | Description |
|---------|-------------|
| **Halo Site URL** | Your blog address, e.g. `https://YOUR_HALO_URL` |
| **Personal Access Token** | Generated in Halo Console → User Profile → Personal Access Tokens |
| **Default Storage Policy** | Attachment policy name, defaults to `default-policy` |

## Usage

1. Open a Markdown note and run the command **"Publish to Halo"** (or bind it to a hotkey).
2. **First publish** — a modal prompts you for title, slug, categories, tags and cover. Confirm to publish.
3. The plugin writes `halo_name` and `halo_url` to your note's frontmatter, along with the metadata you entered.
4. **Subsequent updates** — edit the note body or frontmatter fields, run the command again. The plugin reads frontmatter directly, uploads any new local images, and updates the existing Halo post without showing the modal.

### Frontmatter Fields

After first publish, the following fields are maintained automatically:

```yaml
---
title: "Your Post Title"
slug: "a7b3c9d2e1"
categories: ["Tech", "Life"]
tags: ["obsidian", "halo"]
cover: ""
halo_name: "a7b3c9d2e1"
halo_url: "https://YOUR_HALO_URL/archives/a7b3c9d2e1"
---
```

Modify these fields directly in Obsidian; the plugin uses them on the next publish.

## License

MIT
