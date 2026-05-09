import { App, Notice, TFile, Vault, normalizePath, parseYaml } from "obsidian";
import type { ParsedImage, ContentUpdateParam, Post, PostRequest } from "./types";
import { HaloClient } from "./halo-client";

export class MarkdownProcessor {
	private app: App;
	private client: HaloClient;
	private policyName: string;

	constructor(app: App, client: HaloClient, policyName: string) {
		this.app = app;
		this.client = client;
		this.policyName = policyName;
	}

	parseImages(content: string): ParsedImage[] {
		const images: ParsedImage[] = [];
		const seen = new Set<string>();

		// WikiLink images: ![[image.png]] or ![[path/to/image.png]]
		const wikiRegex = /!\[\[([^\]]+)\]\]/g;
		let match: RegExpExecArray | null;
		while ((match = wikiRegex.exec(content)) !== null) {
			const path = match[1].trim();
			const key = match[0];
			if (seen.has(key)) continue;
			seen.add(key);
			images.push({
				original: key,
				alt: "",
				path,
				isLocal: !this.isExternalUrl(path),
				isWikiLink: true,
			});
		}

		// Standard markdown images: ![alt](path) or ![alt](path "title")
		const mdRegex = /!\[([^\]]*)\]\(([^)\s"]+)(?:\s+"[^"]*")?\)/g;
		while ((match = mdRegex.exec(content)) !== null) {
			const alt = match[1];
			const path = match[2].trim();
			const key = match[0];
			if (seen.has(key)) continue;
			seen.add(key);
			images.push({
				original: key,
				alt,
				path,
				isLocal: !this.isExternalUrl(path),
				isWikiLink: false,
			});
		}

		return images;
	}

	private isExternalUrl(path: string): boolean {
		return /^(https?:)?\/\//i.test(path) || /^[a-z][a-z0-9+.-]*:/i.test(path);
	}

	async processLocalImages(
		content: string,
		images: ParsedImage[],
		sourcePath: string
	): Promise<string> {
		let processed = content;
		const vault = this.app.vault;

		for (const image of images) {
			if (!image.isLocal) continue;

			const tfile = this.resolveImageFile(image.path, sourcePath);
			if (!tfile) {
				new Notice(`Halo Publisher: Could not find image "${image.path}"`, 5000);
				continue;
			}

			try {
				const arrayBuffer = await vault.readBinary(tfile);
				const file = new File([arrayBuffer], tfile.name, {
					type: this.guessMimeType(tfile.extension),
				});
				const attachment = await this.client.uploadAttachment(file, this.policyName);
				const permalink = attachment.status?.permalink;
				if (!permalink) {
					new Notice(`Halo Publisher: Image uploaded but no URL returned for "${image.path}"`, 5000);
					continue;
				}

				// Replace in content
				const replacement = `![${image.alt}](${permalink})`;
				processed = processed.split(image.original).join(replacement);
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				new Notice(`Halo Publisher: Failed to upload image "${image.path}": ${msg}`, 8000);
				continue;
			}
		}

		return processed;
	}

	private resolveImageFile(linkPath: string, sourcePath: string): TFile | null {
		// Try metadata cache resolution first (handles WikiLinks and relative paths)
		const abstractFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
		if (abstractFile instanceof TFile) {
			return abstractFile;
		}

		// Fallback: try as absolute path in vault
		const normalized = normalizePath(linkPath);
		const absFile = this.app.vault.getAbstractFileByPath(normalized);
		if (absFile instanceof TFile) {
			return absFile;
		}

		// Fallback: try resolving relative to source file's directory
		const sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf("/"));
		const relativePath = normalizePath(`${sourceDir}/${linkPath}`);
		const relFile = this.app.vault.getAbstractFileByPath(relativePath);
		if (relFile instanceof TFile) {
			return relFile;
		}

		// Fallback: search by basename across entire vault
		const basename = linkPath.split("/").pop() || linkPath;
		const allFiles = this.app.vault.getAllLoadedFiles();
		for (const f of allFiles) {
			if (f instanceof TFile && f.name === basename) {
				return f;
			}
		}

		return null;
	}

	private guessMimeType(ext: string): string {
		const map: Record<string, string> = {
			png: "image/png",
			jpg: "image/jpeg",
			jpeg: "image/jpeg",
			gif: "image/gif",
			webp: "image/webp",
			svg: "image/svg+xml",
			bmp: "image/bmp",
			avif: "image/avif",
			heic: "image/heic",
			heif: "image/heif",
			ico: "image/x-icon",
			tiff: "image/tiff",
			tif: "image/tiff",
		};
		return map[ext.toLowerCase()] || "application/octet-stream";
	}

	extractFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
		const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/);
		if (!match) {
			return { frontmatter: {}, body: content };
		}

		try {
			const yamlText = match[1];
			const frontmatter = parseYaml(yamlText) as Record<string, unknown>;
			const body = content.slice(match[0].length);
			return { frontmatter, body };
		} catch {
			return { frontmatter: {}, body: content };
		}
	}

	updateFrontmatter(content: string, key: string, value: unknown): string {
		const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/);
		const newline = content.includes("\r\n") ? "\r\n" : "\n";

		if (!match) {
			// No frontmatter exists, create one
			const yamlValue = this.serializeYamlValue(value);
			return `---${newline}${key}: ${yamlValue}${newline}---${newline}${newline}${content}`;
		}

		const yamlText = match[1];
		const lines = yamlText.split(/\r?\n/);
		let updated = false;
		const newLines = lines.map((line) => {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) return line;
			const colonIndex = trimmed.indexOf(":");
			if (colonIndex === -1) return line;
			const lineKey = trimmed.slice(0, colonIndex).trim();
			if (lineKey === key) {
				updated = true;
				const indent = line.match(/^(\s*)/)?.[1] || "";
				return `${indent}${key}: ${this.serializeYamlValue(value)}`;
			}
			return line;
		});

		if (!updated) {
			newLines.push(`${key}: ${this.serializeYamlValue(value)}`);
		}

		const newFrontmatter = newLines.join(newline);
		const body = content.slice(match[0].length);
		return `---${newline}${newFrontmatter}${newline}---${newline}${newline}${body}`;
	}

	private serializeYamlValue(value: unknown): string {
		if (value === null || value === undefined) return "null";
		if (typeof value === "boolean") return String(value);
		if (typeof value === "number") return String(value);
		if (Array.isArray(value)) {
			return `[${value.map((v) => `"${String(v)}"`).join(", ")}]`;
		}
		return `"${String(value)}"`;
	}

	buildPostPayload(
		title: string,
		slug: string,
		body: string,
		categories: string[],
		tags: string[],
		cover?: string,
		name?: string
	): PostRequest {
		const excerptText = body
			.replace(/!\[.*?\]\(.*?\)/g, "")
			.replace(/[#*`\[\]()>|-]/g, "")
			.trim()
			.slice(0, 200);

		const post: Post = {
			apiVersion: "content.halo.run/v1alpha1",
			kind: "Post",
			metadata: {
				name: name || slug,
			},
			spec: {
				title,
				slug,
				allowComment: true,
				deleted: false,
				excerpt: {
					autoGenerate: false,
					raw: excerptText,
				},
				pinned: false,
				priority: 0,
				publish: false,
				visible: "PUBLIC",
				categories: categories.length > 0 ? categories : undefined,
				tags,
				cover,
			},
		};

		const content: ContentUpdateParam = {
			raw: body,
			content: this.toHtmlContent(body),
			rawType: "markdown",
		};

		return { post, content };
	}

	private toHtmlContent(markdown: string): string {
		let html = markdown;

		// Convert headers
		html = html.replace(/^#{6}\s+(.+)$/gm, "<h6>$1</h6>");
		html = html.replace(/^#{5}\s+(.+)$/gm, "<h5>$1</h5>");
		html = html.replace(/^#{4}\s+(.+)$/gm, "<h4>$1</h4>");
		html = html.replace(/^#{3}\s+(.+)$/gm, "<h3>$1</h3>");
		html = html.replace(/^#{2}\s+(.+)$/gm, "<h2>$1</h2>");
		html = html.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

		// Convert markdown images to HTML img tags (supports optional title)
		html = html.replace(/!\[([^\]]*)\]\(([^)\s"]+)(?:\s+"[^"]*")?\)/g, '<img src="$2" alt="$1" />');

		// Convert bold and italic
		html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
		html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
		html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

		// Split into blocks and wrap in paragraphs
		const blocks = html.split(/\n{2,}/);
		const wrapped = blocks.map((block) => {
			block = block.trim();
			if (!block) return "";
			// Don't wrap block-level elements
			if (/^<(h[1-6]|img|pre|code|ul|ol|li|blockquote|div|hr)/i.test(block)) {
				return block;
			}
			// Convert single newlines to <br>
			block = block.replace(/\n/g, "<br>\n");
			return `<p>${block}</p>`;
		});

		return wrapped.filter(Boolean).join("\n");
	}
}
