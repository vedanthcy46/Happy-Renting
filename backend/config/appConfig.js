'use strict';

/**
 * Mobile app release manifest.
 *
 * Bump `latestVersion` / `latestVersionCode` here whenever a new build is
 * published to the Play Store. The mobile app polls GET /api/app/version and
 * shows an in-app update card when an update is available.
 */
const appConfig = {
  mobile: {
    // Latest published Play Store version (semver) and versionCode.
    latestVersion: '2.6.0',
    latestVersionCode: 22,
    playStoreUrl: 'https://play.google.com/store/apps/details?id=co.in.happyrenting.tenant',
    // Optional short release notes shown inside the update card.
    releaseNotes: '',
    // Days to wait before re-showing the update card after "Later".
    remindIntervalDays: 3,
  },
};

module.exports = appConfig;