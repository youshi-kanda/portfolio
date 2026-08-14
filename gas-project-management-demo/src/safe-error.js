'use strict';

// Project Progress Manager — Safe Error catalog and secret masking.
// Every error surfaced to a user goes through make() / fromException(), so raw
// exception text (which can embed tokens, keys, or addresses) never reaches the UI.

var V3SafeError = (function () {
  var SENSITIVE_PATTERNS = [
    /ghp_[A-Za-z0-9]{20,}/g,
    /github_pat_[A-Za-z0-9_]{20,}/g,
    /AIza[A-Za-z0-9_-]{20,}/g,
    /sk-[A-Za-z0-9]{20,}/g,
    /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/g,
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    /[?&](?:token|access_token|api_key|key|secret)[^&\s]*/gi,
  ];

  function maskSensitive(str) {
    if (typeof str !== 'string') return String(str);
    var result = str;
    for (var i = 0; i < SENSITIVE_PATTERNS.length; i++) {
      result = result.replace(SENSITIVE_PATTERNS[i], '[MASKED]');
    }
    return result;
  }

  function isSafeCode(code) {
    return V3_CONFIG.SAFE_ERROR_CODES.indexOf(code) !== -1;
  }

  function make(code, detail) {
    var safeCode = isSafeCode(code) ? code : 'unknown_error';
    var safeDetail = maskSensitive(String(detail == null ? '' : detail));
    return {
      ok: false,
      code: safeCode,
      message: safeCode + (safeDetail ? ': ' + safeDetail : ''),
    };
  }

  function fromException(ex, defaultCode) {
    var code = defaultCode || 'unknown_error';
    var raw = ex instanceof Error ? ex.message : String(ex);
    return make(code, raw);
  }

  return {
    maskSensitive: maskSensitive,
    isSafeCode: isSafeCode,
    make: make,
    fromException: fromException,
  };
}());
