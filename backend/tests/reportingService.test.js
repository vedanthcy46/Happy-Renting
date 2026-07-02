const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateOccupancyMetrics } = require('../services/reportingService');

test('calculateOccupancyMetrics returns consistent vacant room and occupancy values', () => {
  const metrics = calculateOccupancyMetrics({ totalRooms: 8, occupiedRooms: 5 });

  assert.deepStrictEqual(metrics, {
    totalRooms: 8,
    occupiedRooms: 5,
    vacantRooms: 3,
    occupancyRate: 62.5,
  });
});
