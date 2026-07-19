/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	darkMode: 'class',
	theme: {
		extend: {
			colors: {
				// NANDA brand palette — matches the existing design system
				nanda: {
					bg: {
						DEFAULT: '#0a0a0f',
						surface: '#12121a',
						elevated: '#1a1a24',
						muted: 'rgba(37,37,48,0.6)'
					},
					primary: {
						DEFAULT: '#6942e6',
						300: '#9999ff',
						400: '#7c5cff',
						500: '#6942e6',
						600: '#5535b8'
					},
					accent: {
						DEFAULT: '#0cd3da',
						300: '#6bfbfc',
						400: '#28eef3',
						500: '#0cd3da',
						600: '#0aabb1'
					},
					success: {
						DEFAULT: '#22c55e',
						muted: 'rgba(34,197,94,0.15)'
					},
					warning: {
						DEFAULT: '#d97706',
						muted: 'rgba(217,119,6,0.15)'
					},
					danger: {
						DEFAULT: '#ef4444',
						muted: 'rgba(239,68,68,0.15)'
					},
					info: {
						DEFAULT: '#3b82f6',
						muted: 'rgba(59,130,246,0.15)'
					},
					text: {
						DEFAULT: '#fafafa',
						muted: '#94a3b8',
						// Bumped from #71717a (~4.13:1 on #0a0a0f — fails WCAG AA)
						// to #8a8a93 (~5.78:1 on #0a0a0f — passes AA 4.5:1 with margin).
						dim: '#8a8a93'
					},
					border: {
						DEFAULT: 'rgba(37,37,48,0.6)',
						hover: 'rgba(105,66,230,0.4)',
						accent: 'rgba(12,211,218,0.4)'
					}
				}
			},
			fontFamily: {
				// Fontsource variable families expose 'Inter Variable' / 'JetBrains Mono Variable';
				// keep the non-variable names as fallbacks so older static @font-face names
				// (or any residual system install) still resolve.
				sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
				mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'monospace']
			},
			backgroundImage: {
				'nanda-gradient': 'linear-gradient(135deg, #6942e6, #0cd3da)',
				'nanda-gradient-subtle':
					'linear-gradient(135deg, rgba(105,66,230,0.1), rgba(12,211,218,0.1))'
			},
			boxShadow: {
				'glow-primary': '0 0 24px rgba(105,66,230,0.08)',
				'glow-accent': '0 0 20px rgba(12,211,218,0.08)'
			},
			maxWidth: {
				container: '1100px'
			}
		}
	},
	plugins: []
};
