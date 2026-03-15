/*\
title: anttt-kit.js
type: application/javascript
module-type: library
\*/
/* eslint-env browser, node */
/* global $tw:false */

"use strict";

/**
 * Converts a number of seconds to a string in HH:MM:SS or MM:SS format.
 * @param {number} seconds - The number of seconds to convert.
 * @returns {string} The formatted time string.
 */
exports.secondsToTime = (seconds) => {
  seconds = Math.floor(seconds);
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;
  const formattedHours = hours > 0 ? `${hours}:` : '';
  const formattedMinutes = minutes.toString().padStart(2, '0');
  const formattedSeconds = seconds.toString().padStart(2, '0');
  return `${formattedHours}${formattedMinutes}:${formattedSeconds}`;
}

/**
  * Shows a toast with a message.
  */
exports.showToast = (message, type = 'error', duration = 6000) => {
  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  toast.innerHTML = message
  
  document.body.appendChild(toast)
  
  requestAnimationFrame(() => {
    toast.classList.add('show');
  })
  
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => {
      toast.remove();
    });
  }, duration)
}

