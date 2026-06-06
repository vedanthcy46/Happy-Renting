const mongoose = require('mongoose');

const systemHealthSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // e.g., 'worker'
  lastHeartbeatAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['healthy', 'unhealthy'], default: 'healthy' }
}, { timestamps: true });

module.exports = mongoose.model('SystemHealth', systemHealthSchema);
