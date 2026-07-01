const { Expo } = require('expo-server-sdk');
const User = require('../models/User');
const Notification = require('../models/Notification');
const logger = require('../config/logger');

// Create a new Expo SDK client
// optionally providing an access token if you have enabled push security
let expo = new Expo();

/**
 * Save a notification to the database and optionally send an Expo push notification
 * @param {Object} params
 * @param {string} params.userId - The ID of the user to notify
 * @param {string} params.title - Notification title
 * @param {string} params.body - Notification body content
 * @param {string} [params.type='general'] - Categorization type
 * @param {Object} [params.data={}] - Additional payload data
 */
const sendPushNotification = async ({ userId, title, body, message, type = 'general', data = {} }) => {
  try {
    const finalMessage = message || body || 'A new notification is available.';

    logger.info('[NOTIFICATION DEBUG]', {
      user: userId,
      type,
      title,
      message: finalMessage
    });

    // 1. Save to database history
    const notification = await Notification.create({
      userId,
      title,
      message: finalMessage,
      type,
      data,
      isRead: false
    });

    // 2. Fetch user to get push tokens
    const user = await User.findById(userId).select('expoPushTokens');
    if (!user || !user.expoPushTokens || user.expoPushTokens.length === 0) {
      logger.info(`[Notifications] Saved to DB but no push tokens for user ${userId}`);
      return notification;
    }

    // 3. Filter valid tokens
    const validTokens = user.expoPushTokens
      .filter(t => t.isActive && Expo.isExpoPushToken(t.token))
      .map(t => t.token);

    if (validTokens.length === 0) {
      return notification;
    }

    // 4. Construct messages
    const messages = validTokens.map(token => ({
      to: token,
      sound: 'default',
      title,
      body: finalMessage,
      data: { notificationId: notification._id, ...data },
    }));

    // 5. Chunk and send via Expo
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (let chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        logger.error(`[Notifications] Error sending chunk: ${error.message}`);
      }
    }

    // Optional: Clean up unregistered tokens based on tickets (DeviceNotRegistered)
    // For now, we just log success.
    logger.info(`[Notifications] Sent ${tickets.length} push notifications to user ${userId}`);

    return notification;
  } catch (err) {
    logger.error(`[Notifications] Failed to send push notification: ${err.message}`);
    throw err;
  }
};

/**
 * Broadcast a notification to all active tenants of a specific owner
 */
const broadcastToTenants = async ({ ownerId, title, body, type = 'broadcast', data = {} }) => {
  try {
    const Tenant = require('../models/Tenant');
    const tenants = await Tenant.find({ ownerId, status: 'active' }).populate('userId', 'expoPushTokens');
    
    let totalSent = 0;
    for (const tenant of tenants) {
      if (tenant.userId) {
        await sendPushNotification({
          userId: tenant.userId._id,
          title,
          body,
          type,
          data
        });
        totalSent++;
      }
    }
    logger.info(`[Notifications] Broadcasted to ${totalSent} tenants of owner ${ownerId}`);
  } catch (err) {
    logger.error(`[Notifications] Broadcast failed: ${err.message}`);
  }
};

module.exports = {
  sendPushNotification,
  broadcastToTenants
};
