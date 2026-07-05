import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  content: [
    './app/**/*.{vue,js,ts}',
    './i18n/**/*.json'
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--tf-color-bg)',
        surface: 'var(--tf-color-surface)',
        'surface-alt': 'var(--tf-color-surface-alt)',
        border: 'var(--tf-color-border)',
        text: 'var(--tf-color-text)',
        'text-muted': 'var(--tf-color-text-muted)',
        'text-inverse': 'var(--tf-color-text-inverse)',
        primary: {
          DEFAULT: 'var(--tf-color-primary)',
          hover: 'var(--tf-color-primary-hover)',
          fg: 'var(--tf-color-primary-fg)'
        },
        'brand-accent': 'var(--tf-color-brand-accent)',
        secondary: 'var(--tf-color-secondary)',
        success: 'var(--tf-color-success)',
        warning: 'var(--tf-color-warning)',
        danger: 'var(--tf-color-danger)',
        info: 'var(--tf-color-info)',
        'priority-low': 'var(--tf-color-priority-low)',
        'priority-medium': 'var(--tf-color-priority-medium)',
        'priority-high': 'var(--tf-color-priority-high)',
        'priority-critical': 'var(--tf-color-priority-critical)',
        'navbar-bg': 'var(--tf-color-navbar-bg)',
        'sidebar-bg': 'var(--tf-color-sidebar-bg)',
        'sidebar-text': 'var(--tf-color-sidebar-text)',
        'sidebar-text-active': 'var(--tf-color-sidebar-text-active)'
      },
      boxShadow: {
        card: 'var(--tf-shadow-card)',
        modal: 'var(--tf-shadow-modal)',
        glow: 'var(--tf-shadow-glow)'
      }
    }
  }
}
