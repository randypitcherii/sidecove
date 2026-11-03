const ONBOARDING_VERSION_KEY = 'onboardingVersion';

// A fresh install opens the setup guide, unless onboarding was already completed (synced from
// another device). An update opens it once for each version whose guide has not been seen.
export async function openOnboardingIfDue(details) {
    const version = chrome.runtime.getManifest().version;
    const result = await chrome.storage.sync.get(['onboardingCompleted', ONBOARDING_VERSION_KEY]);
    const firstInstall = details.reason === 'install' && !result.onboardingCompleted;
    const newVersion = details.reason === 'update' && result[ONBOARDING_VERSION_KEY] !== version;
    if (firstInstall || newVersion) {
        chrome.tabs.create({ url: 'installation-onboarding.html', active: true });
    }
}
