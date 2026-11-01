// Rule-based guesses for Czech name forms. Good for common given names, editable where it matters.

export function vocative(name: string): string {
  const l = name.toLowerCase();
  if (['máma', 'mamka', 'maminka', 'mami'].includes(l)) return 'mami';
  if (['táta', 'taťka', 'tatínek', 'tati'].includes(l)) return 'tati';
  if (/a$/i.test(name)) return name.slice(0, -1) + 'o';
  return name;
}

const SOFT = 'ňďťjšžčřcŇĎŤJŠŽČŘC';

export function instrumental(name: string): string {
  if (/a$/i.test(name)) return name.slice(0, -1) + 'ou';
  if (/[eěií]$/i.test(name)) return name + 'm';
  return name + 'em';
}

export function genitive(name: string): string {
  if (/a$/i.test(name)) return name.slice(0, -1) + (SOFT.includes(name.slice(-2, -1)) ? 'i' : 'y');
  if (SOFT.includes(name.slice(-1))) return name + 'e';
  if (/[eěií]$/i.test(name)) return name;
  return name + 'a';
}

export const joinCs = (a: string[]) => (a.length <= 1 ? a[0] ?? '' : a.slice(0, -1).join(', ') + ' a ' + a[a.length - 1]);

/** "s" becomes "se" before words starting with s/z/š/ž. */
export const withPrep = (s: string) => (/^[sSzZšŠžŽ]/.test(s) ? 'se ' : 's ') + s;
