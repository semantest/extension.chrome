interface MigrationResult {
  success: boolean;
  alreadyMigrated?: boolean;
  migratedSites?: number;
  deniedSites?: number;
  error?: any;
}

interface FrequentSite {
  origin: string;
  visits: number;
}

interface UserChoices {
  approved: string[];
  denied: string[];
}

interface MigrationStatus {
  version: string;
  migratedAt: number;
  sites: UserChoices;
}

export class PermissionMigrationService {
  private readonly MIGRATION_KEY = 'semantest:permission_migration_v2';
  private readonly SUPPORTED_SITES = [
    'https://chat.openai.com',
    'https://www.google.com',
    'https://www.wikipedia.org',
    'https://github.com',
    'https://stackoverflow.com'
  ];
  
  async migrateFromAllUrlsPermission(): Promise<MigrationResult> {
    const hasMigrated = await this.checkMigrationStatus();
    if (hasMigrated) {
      return { success: true, alreadyMigrated: true };
    }
    
    try {
      // Check if extension has all_urls permission
      const currentPermissions = await chrome.permissions.getAll();
      const hasAllUrls = currentPermissions.origins?.includes('<all_urls>') || 
                        currentPermissions.origins?.includes('*://*/*');
      
      if (!hasAllUrls) {
        // Already using specific permissions
        await this.saveMigrationStatus({ approved: [], denied: [] });
        return { success: true, alreadyMigrated: true };
      }
      
      // Get user's frequently visited sites
      const frequentSites = await this.getFrequentSites();
      
      // Show migration UI
      const userChoices = await this.showMigrationUI(frequentSites);
      
      // Remove all_urls permission
      await this.removeAllUrlsPermission();
      
      // Grant specific permissions based on user choices
      for (const site of userChoices.approved) {
        try {
          await chrome.permissions.request({
            origins: [`${site}/*`]
          });
        } catch (error) {
          console.error(`Failed to grant permission for ${site}:`, error);
        }
      }
      
      // Save migration status
      await this.saveMigrationStatus(userChoices);
      
      // Show completion notification
      this.showCompletionNotification(userChoices);
      
      return {
        success: true,
        migratedSites: userChoices.approved.length,
        deniedSites: userChoices.denied.length
      };
      
    } catch (error) {
      console.error('Migration failed:', error);
      return { success: false, error };
    }
  }
  
  private async checkMigrationStatus(): Promise<boolean> {
    const result = await chrome.storage.local.get(this.MIGRATION_KEY);
    return !!result[this.MIGRATION_KEY];
  }
  
  private async saveMigrationStatus(choices: UserChoices): Promise<void> {
    const status: MigrationStatus = {
      version: '2.0',
      migratedAt: Date.now(),
      sites: choices
    };
    
    await chrome.storage.local.set({
      [this.MIGRATION_KEY]: status
    });
  }
  
  private async removeAllUrlsPermission(): Promise<void> {
    try {
      await chrome.permissions.remove({
        origins: ['<all_urls>']
      });
    } catch (error) {
      // Try alternative format
      await chrome.permissions.remove({
        origins: ['*://*/*']
      });
    }
  }
  
  private async getFrequentSites(): Promise<FrequentSite[]> {
    try {
      const history = await chrome.history.search({
        text: '',
        maxResults: 1000,
        startTime: Date.now() - 30 * 24 * 60 * 60 * 1000 // Last 30 days
      });
      
      // Analyze and rank sites by visit frequency
      const siteFrequency = new Map<string, number>();
      
      for (const item of history) {
        try {
          const url = new URL(item.url || '');
          const origin = url.origin;
          
          // Only consider http/https sites
          if (origin.startsWith('http')) {
            siteFrequency.set(origin, (siteFrequency.get(origin) || 0) + (item.visitCount || 1));
          }
        } catch {
          // Invalid URL, skip
        }
      }
      
      // Sort by frequency and filter supported sites
      const allSites = Array.from(siteFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([origin, visits]) => ({ origin, visits }));
      
      // Prioritize supported sites
      const supportedSites = allSites.filter(site => 
        this.SUPPORTED_SITES.some(supported => site.origin.includes(supported))
      );
      
      const otherFrequentSites = allSites
        .filter(site => !this.SUPPORTED_SITES.some(supported => site.origin.includes(supported)))
        .slice(0, 10);
      
      return [...supportedSites, ...otherFrequentSites];
    } catch (error) {
      console.error('Failed to get browsing history:', error);
      // Return default supported sites if history access fails
      return this.SUPPORTED_SITES.map(origin => ({ origin, visits: 0 }));
    }
  }
  
  private async showMigrationUI(frequentSites: FrequentSite[]): Promise<UserChoices> {
    return new Promise((resolve) => {
      // Create migration UI
      chrome.windows.create({
        url: chrome.runtime.getURL('migration.html'),
        type: 'popup',
        width: 600,
        height: 700
      }, (window) => {
        // Send frequent sites to migration page
        chrome.runtime.onMessage.addListener(function listener(message) {
          if (message.type === 'GET_MIGRATION_SITES') {
            chrome.runtime.sendMessage({
              type: 'MIGRATION_SITES',
              sites: frequentSites
            });
          } else if (message.type === 'MIGRATION_COMPLETE') {
            chrome.runtime.onMessage.removeListener(listener);
            chrome.windows.remove(window!.id!);
            resolve(message.choices);
          }
        });
      });
    });
  }
  
  private showCompletionNotification(choices: UserChoices): void {
    const message = choices.approved.length > 0
      ? `Permissions updated! Granted access to ${choices.approved.length} sites.`
      : 'Permissions updated! You can grant site access when needed.';
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon-128.png',
      title: 'Semantest Permission Migration Complete',
      message,
      buttons: [
        { title: 'Manage Permissions' }
      ]
    });
    
    chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
      if (buttonIndex === 0) {
        chrome.runtime.openOptionsPage();
      }
    });
  }
  
  async getMigrationStatus(): Promise<MigrationStatus | null> {
    const result = await chrome.storage.local.get(this.MIGRATION_KEY);
    return result[this.MIGRATION_KEY] || null;
  }
  
  async resetMigration(): Promise<void> {
    // For testing purposes only
    await chrome.storage.local.remove(this.MIGRATION_KEY);
  }
}