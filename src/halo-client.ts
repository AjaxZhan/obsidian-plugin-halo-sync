import type { HaloSettings, PostRequest, ContentUpdateParam, Attachment, Category, Post, Tag } from "./types";

export class HaloClient {
	private settings: HaloSettings;

	constructor(settings: HaloSettings) {
		this.settings = settings;
	}

	private getBaseUrl(): string {
		return this.settings.siteUrl.replace(/\/$/, "");
	}

	private async request<T>(
		method: string,
		path: string,
		body?: BodyInit,
		headers?: Record<string, string>
	): Promise<T> {
		const url = `${this.getBaseUrl()}${path}`;
		const isFormData = body instanceof FormData;
		const requestHeaders: Record<string, string> = {
			Authorization: `Bearer ${this.settings.patToken}`,
			...(isFormData ? {} : headers),
		};

		const response = await fetch(url, {
			method,
			headers: requestHeaders,
			body,
		});

		if (!response.ok) {
			const text = await response.text().catch(() => "");
			throw new Error(
				`Halo API error ${response.status}: ${response.statusText}${text ? " - " + text : ""}`
			);
		}

		return response.json() as Promise<T>;
	}

	async uploadAttachment(file: File, policyName: string): Promise<Attachment> {
		const formData = new FormData();
		formData.append("file", file);
		formData.append("policyName", policyName);

		const attachment = await this.request<Attachment>(
			"POST",
			"/apis/api.console.halo.run/v1alpha1/attachments/upload",
			formData
		);

		// Halo may return a relative permalink; convert to absolute URL
		if (attachment.status?.permalink && !attachment.status.permalink.startsWith("http")) {
			const base = this.settings.siteUrl.replace(/\/$/, "");
			const path = attachment.status.permalink.startsWith("/")
				? attachment.status.permalink
				: "/" + attachment.status.permalink;
			attachment.status.permalink = base + path;
		}

		return attachment;
	}

	async createPost(request: PostRequest): Promise<Post> {
		return this.request<Post>(
			"POST",
			"/apis/api.console.halo.run/v1alpha1/posts",
			JSON.stringify(request),
			{ "Content-Type": "application/json" }
		);
	}

	async updatePost(name: string, post: Post): Promise<void> {
		await this.request<void>(
			"PUT",
			`/apis/api.console.halo.run/v1alpha1/posts/${name}`,
			JSON.stringify(post),
			{ "Content-Type": "application/json" }
		);
	}

	async updatePostContent(name: string, content: ContentUpdateParam): Promise<void> {
		await this.request<void>(
			"PUT",
			`/apis/api.console.halo.run/v1alpha1/posts/${name}/content`,
			JSON.stringify(content),
			{ "Content-Type": "application/json" }
		);
	}

	async publishPost(name: string): Promise<void> {
		await this.request<void>(
			"PUT",
			`/apis/api.console.halo.run/v1alpha1/posts/${name}/publish`
		);
	}

	async getPost(name: string): Promise<unknown> {
		return this.request<unknown>(
			"GET",
			`/apis/api.console.halo.run/v1alpha1/posts/${name}`
		);
	}

	async listCategories(): Promise<{ items: Category[] }> {
		return this.request<{ items: Category[] }>(
			"GET",
			"/apis/api.content.halo.run/v1alpha1/categories"
		);
	}

	async listTags(): Promise<{ items: Tag[] }> {
		return this.request<{ items: Tag[] }>(
			"GET",
			"/apis/api.content.halo.run/v1alpha1/tags"
		);
	}

	async createTag(tag: Tag): Promise<Tag> {
		return this.request<Tag>(
			"POST",
			"/apis/content.halo.run/v1alpha1/tags",
			JSON.stringify(tag),
			{ "Content-Type": "application/json" }
		);
	}
}
