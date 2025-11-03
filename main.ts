import { App, Plugin, PluginSettingTab, Setting, TFile, moment } from 'obsidian';

interface UsageTrackerSettings {
	totalUsageTime: number;
	lastStartTime: number;
	isTracking: boolean;
}

const DEFAULT_SETTINGS: UsageTrackerSettings = {
	totalUsageTime: 0,
	lastStartTime: 0,
	isTracking: false
}

export default class UsageTrackerPlugin extends Plugin {
	settings: UsageTrackerSettings;
	private statusBarItem: HTMLElement;
	private updateInterval: number;

	async onload() {
		await this.loadSettings();
		
		// Create status bar item
		this.statusBarItem = this.addStatusBarItem();
		this.statusBarItem.createEl("span", { text: "Total Usage: " });
		
		// Start tracking when plugin loads
		this.startTracking();
		
		// Update display every second
		this.updateInterval = window.setInterval(() => {
			this.updateDisplay();
		}, 1000);
		
		// Add settings tab
		this.addSettingTab(new UsageTrackerSettingTab(this.app, this));
		
		// Add ribbon icon
		this.addRibbonIcon('clock', 'Usage Tracker', () => {
			this.showUsageStats();
		});
		
		// Register commands
		this.addCommand({
			id: 'show-usage-stats',
			name: 'Show usage statistics',
			callback: () => {
				this.showUsageStats();
			}
		});
		
		this.addCommand({
			id: 'reset-usage-stats',
			name: 'Reset usage statistics',
			callback: () => {
				this.resetUsageStats();
			}
		});
	}

	onunload() {
		this.stopTracking();
		if (this.updateInterval) {
			window.clearInterval(this.updateInterval);
		}
	}

	startTracking() {
		if (!this.settings.isTracking) {
			this.settings.lastStartTime = Date.now();
			this.settings.isTracking = true;
			this.saveSettings();
		}
	}

	stopTracking() {
		if (this.settings.isTracking) {
			const currentTime = Date.now();
			const sessionTime = currentTime - this.settings.lastStartTime;
			this.settings.totalUsageTime += sessionTime;
			this.settings.isTracking = false;
			this.saveSettings();
		}
	}

	updateDisplay() {
		let currentTotal = this.settings.totalUsageTime;
		
		if (this.settings.isTracking) {
			const currentTime = Date.now();
			currentTotal += (currentTime - this.settings.lastStartTime);
		}
		
		const hours = Math.floor(currentTotal / (1000 * 60 * 60));
		const minutes = Math.floor((currentTotal % (1000 * 60 * 60)) / (1000 * 60));
		const seconds = Math.floor((currentTotal % (1000 * 60)) / 1000);
		
		this.statusBarItem.setText(`Total: ${hours}h ${minutes}m ${seconds}s`);
	}

	showUsageStats() {
		const totalMs = this.settings.totalUsageTime;
		const hours = Math.floor(totalMs / (1000 * 60 * 60));
		const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
		const seconds = Math.floor((totalMs % (1000 * 60)) / 1000);
		
		const days = Math.floor(hours / 24);
		const remainingHours = hours % 24;
		
		new Notice(
			`Total Usage Time:\n` +
			`${days} days, ${remainingHours} hours, ${minutes} minutes, ${seconds} seconds\n` +
			`Total: ${hours} hours`
		);
	}

	resetUsageStats() {
		this.settings.totalUsageTime = 0;
		this.settings.lastStartTime = Date.now();
		this.saveSettings();
		this.updateDisplay();
		new Notice('Usage statistics reset!');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class UsageTrackerSettingTab extends PluginSettingTab {
	plugin: UsageTrackerPlugin;

	constructor(app: App, plugin: UsageTrackerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();
		
		const totalMs = this.plugin.settings.totalUsageTime;
		const hours = Math.floor(totalMs / (1000 * 60 * 60));
		const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
		const seconds = Math.floor((totalMs % (1000 * 60)) / 1000);
		const days = Math.floor(hours / 24);
		const remainingHours = hours % 24;

		new Setting(containerEl)
			.setName('Total Usage Time')
			.setDesc(`Days: ${days}, Hours: ${remainingHours}, Minutes: ${minutes}, Seconds: ${seconds}`)
			.addButton(button => button
				.setButtonText('Reset Counter')
				.onClick(() => {
					this.plugin.resetUsageStats();
					this.display();
				}));

		new Setting(containerEl)
			.setName('Export Usage Data')
			.setDesc('Export your usage statistics to a note')
			.addButton(button => button
				.setButtonText('Export to Note')
				.onClick(() => {
					this.exportToNote();
				}));
	}

	async exportToNote() {
		const totalMs = this.plugin.settings.totalUsageTime;
		const hours = Math.floor(totalMs / (1000 * 60 * 60));
		const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
		const seconds = Math.floor((totalMs % (1000 * 60)) / 1000);
		const days = Math.floor(hours / 24);
		const remainingHours = hours % 24;
		
		const content = `# Usage Statistics
		
## Total Obsidian Usage Time

- **Total Days:** ${days}
- **Total Hours:** ${hours}
- **Detailed Time:** ${days} days, ${remainingHours} hours, ${minutes} minutes, ${seconds} seconds
- **Total Milliseconds:** ${totalMs}

*Last updated: ${new Date().toLocaleString()}*`;

		try {
			const fileName = `Usage Statistics ${new Date().toISOString().split('T')[0]}.md`;
			const file = this.app.vault.getAbstractFileByPath(fileName);
			
			if (file && file instanceof TFile) {
				await this.app.vault.modify(file, content);
				new Notice('Usage statistics updated in existing note!');
			} else {
				await this.app.vault.create(fileName, content);
				new Notice('Usage statistics exported to new note!');
			}
		} catch (error) {
			new Notice('Error exporting usage statistics: ' + error);
		}
	}
}