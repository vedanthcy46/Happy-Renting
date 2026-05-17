'use strict';

const resend = require('../config/emailConfig');

async function testResend() {
  try {
    console.log('Attempting mock email dispatch...');
    const { data, error } = await resend.emails.send({
      from: 'Happy Renting <support@happyrenting.co.in>',
      to: ['vedanthh46@gmail.com'],
      reply_to: 'vedanthh46@gmail.com',
      subject: 'Resend API Key Diagnostics Test',
      html: '<h1>Hello!</h1><p>This is a diagnostics test for Resend email delivery on Happy Renting.</p>'
    });

    if (error) {
      console.error('Resend returned an error:', error);
    } else {
      console.log('Resend success! Data:', data);
    }
  } catch (err) {
    console.error('Failed to run Resend test:', err);
  }
  process.exit(0);
}

testResend();
