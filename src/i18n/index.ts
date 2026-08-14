import ptBR from "./pt-BR";
import en from "./en";
import es from "./es";
import rpgItemsPt from "./items/pt";
import rpgItemsEn from "./items/en";
import rpgItemsEs from "./items/es";

const locales: Record<string, Record<string, string>> = {
  "pt-BR": { ...ptBR, ...rpgItemsPt },
  en: { ...en, ...rpgItemsEn },
  es: { ...es, ...rpgItemsEs },
};

export type Locale = "pt-BR" | "en" | "es";

export function t(key: string, locale: string = "pt-BR"): string {
  const dict = locales[locale] ?? locales["pt-BR"];
  return dict[key] ?? locales["pt-BR"]?.[key] ?? key;
}

export const supportedLocales: { code: Locale; label: string }[] = [
  { code: "pt-BR", label: "Português (Brasil)" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

export default locales;
