// Sentry config — registers window.sentryOnLoad before the async loader fires.
// Skipped on localhost so dev errors don't pollute the dashboard.
// Loaded as a synchronous external script in index.html so the callback is set
// before the async Sentry CDN loader picks it up.
(function () {
  var host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") return;
  window.sentryOnLoad = function () {
    Sentry.init({
      environment: host === "konsacard.pk" ? "production" : "preview",
      ignoreErrors: [
        "ResizeObserver loop limit exceeded",
        "Non-Error promise rejection captured",
        /chrome-extension:/,
        /^Script error\.?$/,
      ],
    });
  };
})();
