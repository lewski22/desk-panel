import React from 'react';
import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { i18n } = useTranslation();
  const change = (lng: string) => i18n.changeLanguage(lng);
  return (
    <select
      value={i18n.language}
      onChange={(e) => change(e.target.value)}
      className={`border border-zinc-200 rounded px-2 py-1 text-sm ${className}`}
    >
      <option value="pl">PL</option>
      <option value="en">EN</option>
    </select>
  );
}
