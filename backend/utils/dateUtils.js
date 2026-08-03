'use strict';

/**
 * Returns the current date in Asia/Kolkata timezone.
 * This keeps cron-based billing logic consistent even when the server runs in UTC.
 */
const getBusinessDate = (date = new Date()) => {
  const inputDate = date instanceof Date ? date : new Date(date);
  const utcTime = inputDate.getTime() + inputDate.getTimezoneOffset() * 60000;
  return new Date(utcTime + 5.5 * 60 * 60 * 1000);
};

const getBusinessMonthString = (date = new Date()) => {
  const businessDate = getBusinessDate(date);
  return `${businessDate.getFullYear()}-${String(businessDate.getMonth() + 1).padStart(2, '0')}`;
};

module.exports = {
  getBusinessDate,
  getBusinessMonthString
};
