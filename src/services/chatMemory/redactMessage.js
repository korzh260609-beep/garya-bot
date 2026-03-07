'use strict';

function redactMessage(input) {
  if (input === null || input === undefined) {
    return '';
  }

  let text = String(input);

  // remove telegram mentions / username-like handles
  text = text.replace(/(^|\s)@[\p{L}\p{N}_]{2,64}/gu, '$1[mention]');

  // remove emails
  text = text.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
    '[email]'
  );

  // remove phone-like values
  text = text.replace(
    /(?<!\w)(\+?\d[\d\s().\-]{7,}\d)(?!\w)/g,
    '[phone]'
  );

  // remove t.me links
  text = text.replace(
    /\bhttps?:\/\/t\.me\/[^\s]+/giu,
    '[telegram_link]'
  );

  // remove explicit profile links (generic)
  text = text.replace(
    /\bhttps?:\/\/[^\s]+/giu,
    '[link]'
  );

  return text.trim();
}

module.exports = {
  redactMessage,
};