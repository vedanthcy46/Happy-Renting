'use strict';

const PDFDocument = require('pdfkit');

/**
 * Generates a PDF receipt buffer for payment events.
 * @param {Object} paymentData 
 * @param {Object} tenantUser 
 * @param {Object} ownerUser 
 * @param {Object} property 
 * @param {Object} room 
 * @returns {Promise<Buffer>}
 */
const generateReceiptPDF = (paymentData, tenantUser, ownerUser, property, room) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Header
      doc.fontSize(24).fillColor('#2563eb').text('RENT RECEIPT', { align: 'center' });
      doc.moveDown();
      
      // Receipt Details
      doc.fontSize(12).fillColor('#000000');
      doc.text(`Receipt Date: ${new Date().toLocaleDateString('en-IN')}`, { align: 'right' });
      doc.text(`Receipt No: RCT-${Date.now().toString().slice(-6)}`, { align: 'right' });
      doc.moveDown(2);

      // Property & Parties
      doc.fontSize(14).text('Property Details:').fontSize(12);
      doc.text(`${property.name}, Room ${room.roomNumber}`);
      doc.moveDown();

      doc.text(`Received From: ${tenantUser.name}`);
      doc.text(`Landlord: ${ownerUser.name}`);
      doc.moveDown(2);

      // Payment Box
      doc.rect(50, doc.y, 500, 100).stroke();
      doc.moveDown(0.5);
      doc.fontSize(14).text(`Payment For Month: ${paymentData.month || 'Settlement'}`, { indent: 10 });
      doc.text(`Amount Paid: Rs. ${paymentData.amount.toLocaleString()}`, { indent: 10 });
      doc.text(`Payment Method: ${(paymentData.method || 'Online').toUpperCase()}`, { indent: 10 });
      if (paymentData.remainingAmount !== undefined) {
        doc.text(`Remaining Balance: Rs. ${paymentData.remainingAmount.toLocaleString()}`, { indent: 10 });
      }
      
      doc.moveDown(4);
      doc.fontSize(10).fillColor('gray').text('This is an automatically generated receipt by Happy Renting.', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generateReceiptPDF };
