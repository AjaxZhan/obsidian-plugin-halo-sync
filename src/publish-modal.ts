import { App, Modal, ButtonComponent, Setting } from "obsidian";
import type { Category, PublishFormData } from "./types";

export class PublishModal extends Modal {
	private categories: Category[];
	private defaults: Partial<PublishFormData>;
	private onSubmit: (data: PublishFormData) => void;
	private onCancel: () => void;

	private formData: PublishFormData;
	private categoryChecks: Map<string, HTMLInputElement> = new Map();

	constructor(
		app: App,
		categories: Category[],
		defaults: Partial<PublishFormData>,
		onSubmit: (data: PublishFormData) => void,
		onCancel: () => void
	) {
		super(app);
		this.categories = categories;
		this.defaults = defaults;
		this.onSubmit = onSubmit;
		this.onCancel = onCancel;
		this.modalEl.addClass("halo-publish-modal");

		this.formData = {
			title: defaults.title ?? "",
			slug: defaults.slug ?? "",
			categories: defaults.categories ?? [],
			tags: defaults.tags ?? [],
			cover: defaults.cover ?? "",
		};
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.titleEl.setText("Publish to Halo");

		new Setting(contentEl)
			.setName("Title")
			.setDesc("Post title")
			.addText((text) =>
				text.setValue(this.formData.title).onChange((value) => {
					this.formData.title = value.trim();
				})
			);

		new Setting(contentEl)
			.setName("Slug")
			.setDesc("Unique post identifier (auto-generated)")
			.addText((text) =>
				text.setValue(this.formData.slug).onChange((value) => {
					this.formData.slug = value.trim();
				})
			);

		const catSetting = new Setting(contentEl)
			.setName("Categories")
			.setDesc("Select applicable categories");
		const catControl = catSetting.controlEl;
		if (this.categories.length === 0) {
			catControl.createSpan({ text: "No categories found" });
		} else {
			const catContainer = catControl.createDiv("halo-category-list");
			for (const cat of this.categories) {
				const label = catContainer.createEl("label", {
					cls: "halo-category-item",
				});
				const checkbox = label.createEl("input");
				checkbox.type = "checkbox";
				checkbox.value = cat.metadata.name;
				checkbox.checked = this.formData.categories.includes(cat.metadata.name);
				checkbox.style.marginRight = "6px";
				checkbox.addEventListener("change", () => {
					this.updateSelectedCategories();
				});
				this.categoryChecks.set(cat.metadata.name, checkbox);
				label.append(document.createTextNode(cat.spec.displayName || cat.metadata.name));
			}
		}

		new Setting(contentEl)
			.setName("Tags")
			.setDesc("Comma-separated tags")
			.addText((text) =>
				text
					.setValue(this.formData.tags.join(", "))
					.onChange((value) => {
						this.formData.tags = value
							.split(",")
							.map((s) => s.trim())
							.filter((s) => s);
					})
			);

		new Setting(contentEl)
			.setName("Cover")
			.setDesc("Cover image URL (optional)")
			.addText((text) =>
				text.setValue(this.formData.cover).onChange((value) => {
					this.formData.cover = value.trim();
				})
			);

		const actionsEl = contentEl.createDiv("halo-publish-actions");
		new ButtonComponent(actionsEl)
			.setButtonText("Cancel")
			.onClick(() => {
				this.close();
				this.onCancel();
			});

		new ButtonComponent(actionsEl)
			.setButtonText("Publish")
			.setCta()
			.onClick(() => {
				if (!this.formData.title) {
					return;
				}
				this.updateSelectedCategories();
				this.close();
				this.onSubmit(this.formData);
			});
	}

	private updateSelectedCategories(): void {
		const selected: string[] = [];
		for (const [name, checkbox] of this.categoryChecks) {
			if (checkbox.checked) {
				selected.push(name);
			}
		}
		this.formData.categories = selected;
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
