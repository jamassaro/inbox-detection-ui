import { handleRequest } from './handlers';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only this extension's own content script may talk to the worker.
  if (sender.id !== chrome.runtime.id) return false;

  void handleRequest(message, {
    fetchFn: (input, init) => fetch(input, init),
    openTab: (url) => chrome.tabs.create({ url }),
  }).then(sendResponse);
  return true; // keep the channel open for the async response
});
