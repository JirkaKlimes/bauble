import type { Art } from './types';

/** Only http(s) links from user data become clickable. */
export function safeHref(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

export const hostOf = (raw: string) => {
  try { return new URL(raw).hostname.replace(/^www\./, ''); } catch { return ''; }
};

const ART_WORDS: [Art, RegExp][] = [
  ['mug', /hrn|šálek|salek|mug|cup/i], ['book', /knih|book|román|roman|novel/i], ['socks', /ponož|sock/i],
  ['headphones', /sluch|headphone|earbud|airpods/i], ['headlamp', /čelov|celov|lamp|svítil|torch|flashlight/i],
  ['planner', /diář|diar|planner|zápisník|notes|diary|notebook/i], ['candle', /svíč|svic|candle/i],
  ['blanket', /deka|deku|pléd|pled|blanket|throw/i], ['tickets', /lístk|vstupen|ticket/i],
  ['keyboard', /klávesn|klavesn|keyboard/i], ['thermos', /termosk|láhev|lahev|bottle|thermos|flask/i],
  ['beanie', /čepic|cepic|beanie|hat/i], ['flowers', /květin|kvetin|flower/i], ['pottery', /keramik|váza|vaza|pottery|ceramic|vase/i],
  ['voucher', /poukaz|voucher|dárkov|gift card/i], ['train', /vlak|lokomot|železn|train|railway/i],
];
export const guessArt = (s: string): Art => ART_WORDS.find(([, re]) => re.test(s))?.[0] ?? 'gift';

export type UrlGuess = { url: string; host: string; title: string; art: Art };

/** A shop link pasted by a person: normalised URL, host and a title guessed from the path. */
export function guessFromUrl(raw: string): UrlGuess | null {
  const v = raw.trim();
  let u: URL;
  try { u = new URL(v); } catch {
    try { u = new URL('https://' + v); } catch { return null; }
  }
  if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return null;
  const host = u.hostname.replace(/^www\./, '');
  const segs = u.pathname.split('/').filter(Boolean).reverse();
  let slug = segs.find(s => /[a-zá-ž]{3,}/i.test(s) && !/^(p|d|dp|product|produkt|item|cs|cz|en)$/i.test(s)) ?? '';
  try { slug = decodeURIComponent(slug); } catch { /* keep the raw slug */ }
  slug = slug.replace(/\.(html?|php|aspx)$/i, '').replace(/[-_+]+/g, ' ').replace(/\b[a-z]{0,2}\d{4,}\b/gi, '').replace(/\s+/g, ' ').trim();
  const title = slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : '';
  return { url: u.href, host, title, art: guessArt(title + ' ' + host) };
}
