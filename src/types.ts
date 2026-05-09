export interface HaloSettings {
	siteUrl: string;
	patToken: string;
	policyName: string;
	autoPublish: boolean;
}

export interface PostRequest {
	post: Post;
	content: ContentUpdateParam;
}

export interface Post {
	apiVersion: string;
	kind: string;
	metadata: Metadata;
	spec: PostSpec;
}

export interface Metadata {
	name: string;
	annotations?: Record<string, string>;
	labels?: Record<string, string>;
}

export interface PostSpec {
	title: string;
	slug: string;
	allowComment: boolean;
	deleted: boolean;
	excerpt: Excerpt;
	pinned: boolean;
	priority: number;
	publish: boolean;
	visible: string;
	categories?: string[];
	tags?: string[];
	cover?: string;
}

export interface Excerpt {
	autoGenerate: boolean;
	raw?: string;
}

export interface ContentUpdateParam {
	content: string;
	raw: string;
	rawType: string;
}

export interface Attachment {
	apiVersion: string;
	kind: string;
	metadata: Metadata;
	spec: AttachmentSpec;
	status?: AttachmentStatus;
}

export interface AttachmentSpec {
	displayName?: string;
	groupName?: string;
	mediaType?: string;
	ownerName?: string;
	policyName?: string;
	size?: number;
	tags?: string[];
}

export interface AttachmentStatus {
	permalink?: string;
	thumbnails?: Record<string, string>;
}

export interface ParsedImage {
	original: string;
	alt: string;
	path: string;
	isLocal: boolean;
	isWikiLink: boolean;
}

export interface Category {
	metadata: Metadata;
	spec: CategorySpec;
}

export interface CategorySpec {
	displayName: string;
	slug: string;
	children?: string[];
	cover?: string;
	description?: string;
	priority?: number;
}

export interface Tag {
	apiVersion: string;
	kind: string;
	metadata: Metadata;
	spec: TagSpec;
}

export interface TagSpec {
	displayName: string;
	slug: string;
	color?: string;
	cover?: string;
}

export interface PublishFormData {
	title: string;
	slug: string;
	categories: string[];
	tags: string[];
	cover: string;
}
