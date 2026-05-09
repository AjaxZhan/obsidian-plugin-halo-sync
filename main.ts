import {
	Plugin,
	Notice,
	TFile,
	Vault,
	Platform,
} from "obsidian";
import type { HaloSettings, PublishFormData, Category, Tag } from "./src/types";
import { HaloClient } from "./src/halo-client";
import { MarkdownProcessor } from "./src/markdown-processor";
import { HaloPublisherSettingTab } from "./src/settings";
import { PublishModal } from "./src/publish-modal";

const DEFAULT_SETTINGS: HaloSettings = {
	siteUrl: "https://cagurzhan.cn",
	patToken: "",
	policyName: "default-policy",
	autoPublish: false,
};

export default class HaloPublisherPlugin extends Plugin {
	settings: HaloSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addSettingTab(new HaloPublisherSettingTab(this.app, this));

		this.addCommand({
			id: "publish-to-halo",
			name: "Publish to Halo",
			editorCallback: async () => {
				await this.publishCurrentNote();
			},
		});
	}

	onunload(): void {
		// Cleanup if needed
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async publishCurrentNote(): Promise<void> {
		if (!Platform.isDesktop) {
			new Notice("Halo Publisher is only available on desktop.");
			return;
		}

		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile || activeFile.extension !== "md") {
			new Notice("Please open a Markdown file to publish.");
			return;
		}

		if (!this.settings.siteUrl || !this.settings.patToken) {
			new Notice("Halo Publisher: Please configure site URL and PAT token in settings.");
			return;
		}

		try {
			await this.runPublishFlow(activeFile);
		} catch (error) {
			console.error("[Halo Publisher] Publish failed:", error);
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`Halo Publisher: ${message}`, 8000);
		}
	}

	private async runPublishFlow(file: TFile): Promise<void> {
		const vault = this.app.vault;
		const rawContent = await vault.read(file);

		const processor = new MarkdownProcessor(
			this.app,
			new HaloClient(this.settings),
			this.settings.policyName
		);

		const { frontmatter, body } = processor.extractFrontmatter(rawContent);

		const existingName = typeof frontmatter.halo_name === "string" ? frontmatter.halo_name : undefined;
		const isPublished = !!existingName;

		// 从 frontmatter 读取已保存的元数据
		const frontmatterTitle = typeof frontmatter.title === "string" ? frontmatter.title.trim() : undefined;
		const frontmatterSlug = typeof frontmatter.slug === "string" ? frontmatter.slug.trim() : undefined;
		const frontmatterCategories = this.extractStringArray(frontmatter.categories);
		const frontmatterTags = this.extractStringArray(frontmatter.tags);
		const frontmatterCover = typeof frontmatter.cover === "string" ? frontmatter.cover.trim() : undefined;

		const defaultTitle = frontmatterTitle || this.extractTitle(rawContent, file.basename);
		const defaultSlug = frontmatterSlug || this.generateHashSlug();

		const client = new HaloClient(this.settings);

		let categories: Category[] = [];
		try {
			const resp = await client.listCategories();
			categories = resp.items || [];
		} catch (err) {
			console.warn("[Halo Publisher] Failed to fetch categories:", err);
		}

		const images = processor.parseImages(body);
		const localImages = images.filter((img) => img.isLocal);

		let formData: PublishFormData;
		if (!isPublished) {
			// 首次发布：弹窗填写
			formData = await new Promise<PublishFormData>((resolve, reject) => {
				new PublishModal(
					this.app,
					categories,
					{
						title: defaultTitle,
						slug: defaultSlug,
						categories: frontmatterCategories,
						tags: frontmatterTags,
						cover: frontmatterCover || "",
					},
					(data) => resolve(data),
					() => reject(new Error("Cancelled by user"))
				).open();
			});
		} else {
			// 已发布过：直接使用 frontmatter，不弹窗
			formData = {
				title: defaultTitle,
				slug: defaultSlug,
				categories: frontmatterCategories,
				tags: frontmatterTags,
				cover: frontmatterCover || "",
			};
		}

		new Notice("Halo Publisher: Uploading images...", 3000);
		const processedBody = await processor.processLocalImages(body, images, file.path);

		const resolvedTags = await this.resolveTags(client, formData.tags);

		const payload = processor.buildPostPayload(
			formData.title,
			formData.slug,
			processedBody,
			formData.categories,
			resolvedTags,
			formData.cover || undefined,
			existingName
		);

		let name: string;
		if (existingName) {
			try {
				await client.getPost(existingName);
			} catch (err) {
				const msg = err instanceof Error ? err.message : "";
				if (msg.includes("404")) {
					new Notice(`Halo Publisher: Existing post not found, creating new one...`, 3000);
					const newSlug = this.generateHashSlug();
					formData.slug = newSlug;
					const createPayload = processor.buildPostPayload(
						formData.title,
						newSlug,
						processedBody,
						formData.categories,
						formData.tags,
						formData.cover || undefined
					);
					const response = await client.createPost(createPayload);
					name = response.metadata.name;
					await client.publishPost(name);
					await this.writePublishMeta(vault, file, processor, formData, name);
					new Notice(`Halo Publisher: Post "${formData.title}" published successfully.`, 5000);
					return;
				}
				throw err;
			}

			new Notice(`Halo Publisher: Updating post "${formData.title}"...`, 3000);
			await client.updatePost(existingName, payload.post);
			await client.updatePostContent(existingName, payload.content);
			await client.publishPost(existingName);
			name = existingName;
			new Notice(`Halo Publisher: Post "${formData.title}" updated and published.`, 5000);
		} else {
			const response = await client.createPost(payload);
			name = response.metadata.name;
			await client.publishPost(name);
			new Notice(`Halo Publisher: Post "${formData.title}" published successfully.`, 5000);
		}

		await this.writePublishMeta(vault, file, processor, formData, name);
	}

	private async writePublishMeta(
		vault: Vault,
		file: TFile,
		processor: MarkdownProcessor,
		formData: PublishFormData,
		name: string
	): Promise<void> {
		const content = await vault.read(file);
		let updated = processor.updateFrontmatter(content, "title", formData.title);
		updated = processor.updateFrontmatter(updated, "slug", formData.slug);
		updated = processor.updateFrontmatter(updated, "categories", formData.categories);
		updated = processor.updateFrontmatter(updated, "tags", formData.tags);
		updated = processor.updateFrontmatter(updated, "cover", formData.cover);
		updated = processor.updateFrontmatter(updated, "halo_name", name);
		const postUrl = `${this.settings.siteUrl.replace(/\/$/, "")}/archives/${formData.slug}`;
		updated = processor.updateFrontmatter(updated, "halo_url", postUrl);
		await vault.modify(file, updated);
	}

	private extractTitle(content: string, fallback: string): string {
		const h1Match = content.match(/^#\s+(.+)$/m);
		if (h1Match) {
			return h1Match[1].trim();
		}
		return fallback;
	}

	private generateHashSlug(): string {
		const array = new Uint8Array(5);
		crypto.getRandomValues(array);
		return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
	}

	private extractStringArray(value: unknown): string[] {
		if (Array.isArray(value)) {
			return value.filter((v): v is string => typeof v === "string");
		}
		if (typeof value === "string" && value.trim()) {
			return value.split(",").map((s) => s.trim()).filter((s) => s);
		}
		return [];
	}

	private toKebabCase(str: string): string {
		return str
			.replace(/[.,!?;:'"()[\]{}<>@#$%^&*+=|~`\\/]/g, "")
			.trim()
			.replace(/[\s_]+/g, "-")
			.toLowerCase();
	}

	private async resolveTags(client: HaloClient, tagNames: string[]): Promise<string[]> {
		if (tagNames.length === 0) return [];

		let existingTags: Tag[] = [];
		try {
			const resp = await client.listTags();
			existingTags = resp.items || [];
		} catch (err) {
			console.warn("[Halo Publisher] Failed to fetch tags:", err);
		}

		const resolvedNames: string[] = [];
		let permissionWarned = false;
		for (const name of tagNames) {
			const trimmed = name.trim();
			if (!trimmed) continue;

			const lower = trimmed.toLowerCase();
			const existing = existingTags.find(
				(t) =>
					t.spec.displayName.toLowerCase() === lower ||
					t.spec.slug.toLowerCase() === lower
			);

			if (existing) {
				resolvedNames.push(existing.metadata.name);
				continue;
			}

			const slug = this.toKebabCase(trimmed);
			// metadata.name must be DNS subdomain compliant (ASCII only)
			const isAsciiSlug = /^[a-z0-9-]+$/.test(slug);
			const safeName = isAsciiSlug ? slug : this.generateHashSlug();
			try {
				const newTag = await client.createTag({
					apiVersion: "content.halo.run/v1alpha1",
					kind: "Tag",
					metadata: {
						name: safeName,
					},
					spec: {
						displayName: trimmed,
						slug: isAsciiSlug ? slug : safeName,
					},
				});
				resolvedNames.push(newTag.metadata.name);
				existingTags.push(newTag);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				if (msg.includes("403") && !permissionWarned) {
					permissionWarned = true;
					new Notice("Halo Publisher: PAT token lacks tag-manage permission. Tags will be skipped.", 8000);
				}
				console.error(`[Halo Publisher] Failed to create tag "${trimmed}":`, err);
				// Fallback: try raw string in case Halo auto-creates tags
				resolvedNames.push(trimmed);
			}
		}

		return resolvedNames;
	}
}
