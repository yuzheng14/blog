import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: '郁蒸十四的博客',
  description: '🤩',

  head: [['link', { rel: 'icon', href: '/mahiro.jpg' }]],
  srcDir: 'src',

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: { src: '/mahiro.jpg', alt: '头像', width: 24, height: 24 },

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Examples', link: '/markdown-examples' },
    ],

    sidebar: [
      {
        text: 'Blog',
        items: [
          {
            text: 'typescript 语言服务器',
            link: '/typescript/language-service-plugin',
          },
        ],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/yuzheng14' }],
  },
})
