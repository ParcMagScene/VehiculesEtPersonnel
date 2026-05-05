/* Storybook Preview — charge les mêmes CSS que l'app */
import '../src/theme.css';
import '../src/design/tokens.css';
import '../src/design/utilities.css';
import '../src/theme-palettes.css';
import '../src/theme-vscode.css';
import '../src/theme-density.css';
import '../src/theme-tv.css';
import '../src/index.css';

/** @type { import('@storybook/react').Preview } */
const preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#0f172a' },
        { name: 'vscode-dark', value: '#1e1e1e' },
      ],
    },
  },
  decorators: [
    (Story) => (
      <div style={{ padding: '1rem', fontFamily: 'var(--theme-font-sans)' }}>
        <Story />
      </div>
    ),
  ],
};

export default preview;
