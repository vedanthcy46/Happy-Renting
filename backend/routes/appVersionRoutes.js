'use strict';

const express = require('express');
const router = express.Router();
const appConfig = require('../config/appConfig');

/**
 * GET /api/app/version
 * Public endpoint that reports the latest published mobile build. The app polls
 * this to show an in-app "update available" card. No auth required.
 */
router.get('/', (req, res) => {
  const { mobile } = appConfig;
  res.status(200).json({
    success: true,
    platform: 'android',
    latestVersion: mobile.latestVersion,
    latestVersionCode: mobile.latestVersionCode,
    playStoreUrl: mobile.playStoreUrl,
    releaseNotes: mobile.releaseNotes || '',
    remindIntervalDays: mobile.remindIntervalDays ?? 3,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;