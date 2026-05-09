import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type HaloPublisherPlugin from "../main";

export class HaloPublisherSettingTab extends PluginSettingTab {
	plugin: HaloPublisherPlugin;

	constructor(app: App, plugin: HaloPublisherPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Halo Publisher Settings" });

		const hintEl = containerEl.createEl("div", { cls: "setting-item-description" });
		hintEl.style.marginBottom = "1em";
		hintEl.innerText = "Tip: Place local images in an 'assets' folder next to your Markdown file so the plugin can find and upload them.";

		new Setting(containerEl)
			.setName("Halo Site URL")
			.setDesc("Your Halo blog URL, e.g. https://cagurzhan.cn")
			.addText((text) =>
				text
					.setPlaceholder("https://your-halo-site.com")
					.setValue(this.plugin.settings.siteUrl)
					.onChange(async (value) => {
						const trimmed = value.trim();
						if (trimmed && !/^https?:\/\/.+/.test(trimmed)) {
							new Notice("Halo Publisher: Site URL must start with http:// or https://");
							return;
						}
						this.plugin.settings.siteUrl = trimmed;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Personal Access Token")
			.setDesc("Your Halo PAT. Generate it in Halo console: User Profile > Personal Access Tokens")
			.addText((text) => {
				text.inputEl.type = "password";
				text
					.setPlaceholder("pat_xxx")
					.setValue(this.plugin.settings.patToken)
					.onChange(async (value) => {
						this.plugin.settings.patToken = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Default Storage Policy")
			.setDesc("The default attachment storage policy name in Halo")
			.addText((text) =>
				text
					.setPlaceholder("default-policy")
					.setValue(this.plugin.settings.policyName)
					.onChange(async (value) => {
						this.plugin.settings.policyName = value.trim() || "default-policy";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Auto Publish")
			.setDesc("Skip confirmation modal and publish immediately")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoPublish)
					.onChange(async (value) => {
						this.plugin.settings.autoPublish = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
