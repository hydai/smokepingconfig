import { init, register } from 'svelte-i18n';

register('en', () => import('./en.json'));
register('zh-TW', () => import('./zh-TW.json'));

init({
  fallbackLocale: 'en',
  initialLocale: 'en'
});
