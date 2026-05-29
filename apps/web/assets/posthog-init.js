// PostHog product-analytics bootstrap. Mirrors the pattern of ga-init.js: a
// tiny synchronous stub that queues calls until the async SDK loads, so
// trackEvent() etc. work from the moment the page parses.
//
// `phc_*` project keys are designed to be public (they're used in every
// browser worldwide and are write-only ingest), so we ship them inline.
//
// person_profiles="identified_only" keeps the free tier cheap: anonymous
// events still ingest with a stable device-level distinct_id, but no Person
// profile is created until we call posthog.identify() — useful once accounts
// land.
!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId captureTraceFeedback captureTraceMetric".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init("phc_u3389FSqcbWC3XMP3iLbXQXGpGKANkG3ekbTVFwTbQ7M", {
  api_host: "https://us.i.posthog.com",
  person_profiles: "identified_only",
  capture_pageview: true,
  capture_pageleave: true,
  autocapture: true,
  // Mask every <input> / <textarea> value in session replay so things like
  // the salary / balance / search fields aren't visible in recordings. We
  // still record the query value via explicit search_submit events for
  // analytics — replay is only the visual layer.
  session_recording: {
    maskAllInputs: true,
  },
});
