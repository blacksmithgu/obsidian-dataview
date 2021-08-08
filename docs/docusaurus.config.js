/** @type {import('@docusaurus/types').DocusaurusConfig} */
module.exports = {
  title: 'Dataview',
  tagline: 'Advanced queries for Obsidian.md.',
  url: 'https://blacksmithgu.github.io',
  baseUrl: '/obsidian-dataview/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'images/obsidian.ico',
  organizationName: 'blacksmithgu', // Usually your GitHub org/user name.
  projectName: 'obsidian-dataview', // Usually your repo name.
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  themeConfig: {
    navbar: {
      title: 'Dataview',
      logo: {
        alt: 'Dataview',
        src: 'images/obsidian.png',
      },
      items: [
        {
          type: 'doc',
          docId: 'intro',
          position: 'left',
          label: 'Documentation',
        },
        {to: '/blog', label: 'Blog', position: 'left'},
        {
          href: 'https://github.com/blacksmithgu/obsidian-dataview',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Introduction',
              to: '/docs/intro',
            },
            {
              label: 'Query Reference',
              to: '/docs/query/queries',
            },
            {
              label: 'API Reference',
              to: '/docs/api/intro',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/blacksmithgu/obsidian-dataview'
            }
          ],
        },
      ]
    },
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js')
        },
        blog: {
          showReadingTime: true
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
};
