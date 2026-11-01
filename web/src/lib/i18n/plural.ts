export type Forms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

export function plural(locale: string) {
  const rules = new Intl.PluralRules(locale);
  return (n: number, forms: Forms) => forms[rules.select(n)] ?? forms.other;
}
