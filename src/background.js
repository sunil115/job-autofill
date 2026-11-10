/* global chrome, importScripts, fillActiveTab */
importScripts('inject.js');

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'fill-page') await fillActiveTab();
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.runtime.openOptionsPage();
});
