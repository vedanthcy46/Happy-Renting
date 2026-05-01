'use strict';

const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinaryConfig');

/**
 * createUploadMiddleware(folderName)
 * 
 * Returns a configured Multer instance for Cloudinary uploads.
 * 
 * @param {string} folderName - Cloudinary folder to store images
 */
const createUploadMiddleware = (folderName) => {
  const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: folderName,
      allowed_formats: ['jpg', 'png', 'jpeg'],
      transformation: [{ width: 1000, height: 1000, crop: 'limit' }], // Reasonable limit for size
    },
  });

  return multer({
    storage: storage,
    limits: {
      fileSize: 2 * 1024 * 1024, // 2MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG and PNG are allowed.'), false);
      }
    },
  });
};

module.exports = { createUploadMiddleware };
