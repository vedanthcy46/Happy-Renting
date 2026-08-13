const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const Notification = require('../models/Notification');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const { Expo } = require('expo-server-sdk');

// GET /v2/notifications
// Get user notifications (paginated or last 50)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const query = { userId: req.user._id };

    // Incremental sync: only return notifications modified after a timestamp
    const { updatedAfter } = req.query;
    if (updatedAfter && !isNaN(Date.parse(updatedAfter))) {
      query.updatedAt = { $gt: new Date(updatedAfter) };
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Notification.countDocuments({ userId: req.user._id });
    const unreadCount = await Notification.countDocuments({ userId: req.user._id, read: false });

    res.status(200).json({
      success: true,
      count: notifications.length,
      total,
      unreadCount,
      notifications
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /v2/notifications/:id/read
// Mark a notification as read
router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true },
      { returnDocument: 'after' }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({ success: true, notification });
  } catch (err) {
    next(err);
  }
});

// PATCH /v2/notifications/read-all
// Mark all notifications as read
router.patch('/read-all', authenticate, async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { read: true }
    );

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
});

// DELETE /v2/notifications/clear-all
// Delete all notifications for the user
router.delete('/clear-all', authenticate, async (req, res, next) => {
  try {
    await Notification.deleteMany({ userId: req.user._id });
    res.status(200).json({ success: true, message: 'All notifications cleared' });
  } catch (err) {
    next(err);
  }
});

// DELETE /v2/notifications/:id
// Delete a specific notification
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.status(200).json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    next(err);
  }
});

// POST /v2/notifications/test-push
// Send a test push to the current user's device (dev/testing helper)
router.post('/test-push', authenticate, async (req, res, next) => {
  try {
    const { notification, tickets } = await notificationService.sendExpoPushMessages({
      userId: req.user._id,
      title: 'Test Notification',
      body: 'This is a test push. If you can see this, push notifications are working!',
      type: 'system',
    });

    const user = await User.findById(req.user._id).select('expoPushTokens');
    const tokens = ((user && user.expoPushTokens) || []).map(t => t.token);
    const validTokens = tokens.filter(t => Expo.isExpoPushToken(t));

    res.status(200).json({
      success: true,
      message: 'Test push sent.',
      notificationId: notification._id,
      pushTokenCount: tokens.length,
      validPushTokenCount: validTokens.length,
      tickets: tickets.map(t => ({
        status: t.status,
        message: t.message || null,
        error: t.details ? t.details.error || null : null,
        ticketId: t.id || null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
