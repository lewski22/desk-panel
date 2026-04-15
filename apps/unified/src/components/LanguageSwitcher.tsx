import React from 'react';
import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { i18n } = useTranslation();
  return (
    <select
      value={i18n.language}
      onChange={e => i18n.changeLanguage(e.target.value)}
      className={`border border-zinc-700 bg-zinc-800 text-zinc-300 rounded px-2 py-1 text-xs ${className}`}
    >
      <option value="pl">PL</option>
      <option value="en">EN</option>
    </select>
  );
}
