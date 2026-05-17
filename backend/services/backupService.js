'use strict';

const { exec } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

/**
 * Executes a mongodump and encrypts the resulting archive.
 * Replaces the dangerous API-based JSON export.
 */
const runEncryptedBackup = () => {
  const dateStr = new Date().toISOString().split('T')[0];
  const backupDir = path.join(__dirname, '../../backups');
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const archivePath = path.join(backupDir, `db-backup-${dateStr}.archive`);
  const encryptedPath = `${archivePath}.enc`;
  
  // Needs standard MongoDB connection string format
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    logger.error('[BACKUP] MONGO_URI not defined. Cannot run backup.');
    return;
  }

  // 1. Run mongodump
  const command = `mongodump --uri="${mongoUri}" --archive="${archivePath}" --gzip`;

  logger.info(`[BACKUP] Starting mongodump to ${archivePath}`);

  exec(command, (error, stdout, stderr) => {
    if (error) {
      logger.error(`[BACKUP ERROR] Mongodump failed: ${error.message}`);
      return;
    }

    logger.info(`[BACKUP] Mongodump completed. Encrypting...`);

    // 2. Encrypt the archive
    try {
      const algorithm = 'aes-256-cbc';
      const password = process.env.BACKUP_ENCRYPTION_KEY || 'default_insecure_backup_key_32c!';
      // Create a 32 byte key from the password
      const key = crypto.scryptSync(password, 'salt', 32);
      const iv = crypto.randomBytes(16);

      const readStream = fs.createReadStream(archivePath);
      const writeStream = fs.createWriteStream(encryptedPath);
      const cipher = crypto.createCipheriv(algorithm, key, iv);

      // Write the IV at the beginning of the file so we can use it to decrypt
      writeStream.write(iv);

      readStream.pipe(cipher).pipe(writeStream);

      writeStream.on('finish', () => {
        logger.info(`[BACKUP] Encryption complete: ${encryptedPath}`);
        // 3. Delete unencrypted archive
        fs.unlinkSync(archivePath);
        
        // 4. (Optional) Purge old backups (e.g. older than 7 days)
        purgeOldBackups(backupDir, 7);
      });
      
      writeStream.on('error', (err) => {
        logger.error(`[BACKUP ERROR] Encryption stream error: ${err.message}`);
      });
    } catch (err) {
      logger.error(`[BACKUP ERROR] Encryption failed: ${err.message}`);
    }
  });
};

const purgeOldBackups = (backupDir, retentionDays) => {
  const files = fs.readdirSync(backupDir);
  const now = Date.now();
  const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;

  files.forEach((file) => {
    if (file.startsWith('db-backup-') && file.endsWith('.enc')) {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath);
        logger.info(`[BACKUP PURGE] Deleted old backup: ${file}`);
      }
    }
  });
};

module.exports = {
  runEncryptedBackup,
};
