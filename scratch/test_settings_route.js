const express = require('express');
const app = require('./backend/server'); // Assuming server.js exports app
const request = require('supertest');

request(app)
  .patch('/api/v2/admin/settings')
  .send({ subscriptionEnabled: true })
  .expect(res => {
    console.log(res.status);
    console.log(res.body);
  })
  .end((err, res) => {
    if (err) throw err;
    process.exit(0);
  });
