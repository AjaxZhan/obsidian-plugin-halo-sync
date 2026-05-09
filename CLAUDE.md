# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build System

- `npm run build` — Type-check (`tsc -noEmit`) then bundle with esbuild into `main.js`
- `npm run dev` — Same as build but in watch mode
- Entry point: `main.ts` → bundled to `main.js` (CJS, es2018)
- `obsidian`, `electron`, and CodeMirror packages are **external**; they are provided by Obsidian at runtime and must not be bundled

## Architecture

This is an Obsidian plugin that publishes Markdown notes to a [Halo](https://halo.run) blog.

### Core Modules

| File | Responsibility |
|------|----------------|
| `main.ts` | Plugin entry. Registers the "Publish to Halo" command, orchestrates the publish/update flow, and manages frontmatter read/write. |
| `src/halo-client.ts` | Halo REST API client. Handles Bearer auth, uploads attachments, creates/updates/publishes posts, fetches categories/tags, and creates tags. |
| `src/markdown-processor.ts` | Parses frontmatter, resolves local images (WikiLinks `![[…]]` and standard `![alt](path)`), uploads them, replaces references with Halo permalinks, and **converts Markdown to basic HTML** for Halo's `content` field. |
| `src/publish-modal.ts` | Modal UI shown only on first publish. Captures title, slug, categories (multi-select checklist), tags (comma-separated), and cover URL. |
| `src/settings.ts` | Plugin settings tab for site URL, PAT token, storage policy, and auto-publish toggle. |
| `src/types.ts` | Shared interfaces for Halo CRD-style resources (Post, Tag, Category, Attachment) and plugin types. |

### Key Behaviors

- **First publish vs. update**: On first publish, `main.ts` shows `PublishModal`. After a successful publish, `halo_name` and `halo_url` are written to the note's frontmatter. Subsequent runs skip the modal and read metadata directly from frontmatter.
- **Image upload flow**: `MarkdownProcessor.parseImages()` finds all local images, `resolveImageFile()` resolves them via a 4-tier fallback (metadataCache → absolute vault path → relative to note → basename search), uploads each via `HaloClient.uploadAttachment()`, and replaces the original reference with `![alt](permalink)`.
- **Markdown → HTML for Halo**: Halo's `content` field is emitted as raw HTML on the page; it does **not** render Markdown. `MarkdownProcessor.toHtmlContent()` converts images to `<img>` tags, headers to `<h1>`–`<h6>`, bold/italic to `<strong>`/`<em>`, and wraps text blocks in `<p>` tags. The `raw` field keeps the original Markdown for editing.
- **Tag creation endpoint**: Use `/apis/content.halo.run/v1alpha1/tags` (POST). The `api.console` group only supports listing tags, not creating them.
- **Attachment permalink fix**: Halo returns relative permalinks (`/upload/…`). `uploadAttachment()` concatenates them with `siteUrl` to produce absolute URLs.
- **404 fallback on update**: If an existing post (by `halo_name`) returns 404, the plugin creates a new post with a fresh hash slug to avoid name collisions.

## Common Commands

```bash
# Install dependencies
npm install

# Build for production (outputs main.js)
npm run build

# Watch mode during development
npm run dev

# Bump version (updates manifest.json and versions.json from package.json)
npm version patch && npm run version
```

## Halo API Endpoints Used

| Operation | Endpoint |
|-----------|----------|
| Create post | `POST /apis/api.console.halo.run/v1alpha1/posts` |
| Update post | `PUT /apis/api.console.halo.run/v1alpha1/posts/{name}` |
| Update content | `PUT /apis/api.console.halo.run/v1alpha1/posts/{name}/content` |
| Publish | `PUT /apis/api.console.halo.run/v1alpha1/posts/{name}/publish` |
| Upload attachment | `POST /apis/api.console.halo.run/v1alpha1/attachments/upload` |
| List categories | `GET /apis/api.content.halo.run/v1alpha1/categories` |
| List tags | `GET /apis/api.content.halo.run/v1alpha1/tags` |
| Create tag | `POST /apis/content.halo.run/v1alpha1/tags` |
