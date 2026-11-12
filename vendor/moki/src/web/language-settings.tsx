import {useState} from 'react';
import {LanguageSaveError, saveLanguage, t, useI18n, type InterfaceLanguage} from './i18n.js';

export function LanguageSettings() {
  const language = useI18n();
  const [error, setError] = useState<'restart-required' | 'save-failed' | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async (value: InterfaceLanguage) => {
    setError(null); setSaving(true);
    try { await saveLanguage(value); }
    catch (cause) { setError(cause instanceof LanguageSaveError ? cause.code : 'save-failed'); }
    finally { setSaving(false); }
  };
  return <section className="settings-language-section">
    <label className="settings-language-row" htmlFor="interface-language">
      <span><strong>{t('界面语言')}</strong><small id="interface-language-description">{t('切换后立即生效，白板内容保持原样。')}</small></span>
      <select id="interface-language" aria-label={t('界面语言')} aria-describedby="interface-language-description" value={language} disabled={saving} onChange={event => void save(event.target.value as InterfaceLanguage)}>
        <option value="zh-CN">简体中文</option><option value="en">English</option>
      </select>
    </label>
    {error === 'restart-required' ? <p className="settings-language-notice" role="status">{window.mokiDshEmbed
      ? t('语言已切换。请完全退出并重新打开 DSH，再选择语言以保存设置。')
      : t('语言已切换。请重新启动白板应用，再选择语言以保存设置。')}</p> : null}
    {error === 'save-failed' ? <p role="alert">{t('语言已切换，但保存失败，请重试。')} <button type="button" onClick={() => void save(language)}>{t('重试')}</button></p> : null}
  </section>;
}
