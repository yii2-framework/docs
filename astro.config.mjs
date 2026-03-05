// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { remarkAutoTitle } from './plugins/remark-auto-title.mjs';
import { rehypeFixLinks } from './plugins/rehype-fix-links.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://yii2-framework.github.io',
  base: '/docs',
  markdown: {
    remarkPlugins: [remarkAutoTitle],
    rehypePlugins: [rehypeFixLinks],
  },
  integrations: [
    starlight({
      title: 'Yii2 Framework',
      logo: {
        light: './src/assets/logo-light.svg',
        dark: './src/assets/logo-dark.svg',
        replacesTitle: true,
      },
      components: {
        SocialIcons: './src/components/SocialIcons.astro',
      },
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        ar: { label: 'العربية', lang: 'ar', dir: 'rtl' },
        de: { label: 'Deutsch', lang: 'de' },
        es: { label: 'Español', lang: 'es' },
        fa: { label: 'فارسی', lang: 'fa', dir: 'rtl' },
        fr: { label: 'Français', lang: 'fr' },
        id: { label: 'Bahasa Indonesia', lang: 'id' },
        it: { label: 'Italiano', lang: 'it' },
        ja: { label: '日本語', lang: 'ja' },
        pl: { label: 'Polski', lang: 'pl' },
        'pt-br': { label: 'Português (Brasil)', lang: 'pt-BR' },
        ru: { label: 'Русский', lang: 'ru' },
        'sr-latn': { label: 'Srpski (Latin)', lang: 'sr-Latn' },
        tr: { label: 'Türkçe', lang: 'tr' },
        uk: { label: 'Українська', lang: 'uk' },
        uz: { label: 'O\'zbek', lang: 'uz' },
        vi: { label: 'Tiếng Việt', lang: 'vi' },
        'zh-cn': { label: '简体中文', lang: 'zh-CN' },
      },
      sidebar: [
        {
          label: 'Project',
          collapsed: true,
          items: [
            { label: 'Overview', slug: 'project' },
            { label: 'Installation', slug: 'project/installation' },
            { label: 'Configuration', slug: 'project/configuration' },
            { label: 'Examples', slug: 'project/examples' },
            { label: 'Testing', slug: 'project/testing' },
            { label: 'Development', slug: 'project/development' },
            { label: 'Documentation Style Guide', slug: 'project/documentation-style-guide' },
          ],
        },
        {
          label: 'Introduction',
          items: [
            { label: 'About Yii', slug: 'guide/intro-yii' },
            { label: 'Upgrading from Version 1.1', slug: 'guide/intro-upgrade-from-v1' },
          ],
        },
        {
          label: 'Getting Started',
          items: [
            { label: 'What do you need to know', slug: 'guide/start-prerequisites' },
            { label: 'Installing Yii', slug: 'guide/start-installation' },
            { label: 'Running Applications', slug: 'guide/start-workflow' },
            { label: 'Saying Hello', slug: 'guide/start-hello' },
            { label: 'Working with Forms', slug: 'guide/start-forms' },
            { label: 'Working with Databases', slug: 'guide/start-databases' },
            { label: 'Generating Code with Gii', slug: 'guide/start-gii' },
            { label: 'Looking Ahead', slug: 'guide/start-looking-ahead' },
          ],
        },
        {
          label: 'Application Structure',
          items: [
            { label: 'Overview', slug: 'guide/structure-overview' },
            { label: 'Entry Scripts', slug: 'guide/structure-entry-scripts' },
            { label: 'Applications', slug: 'guide/structure-applications' },
            { label: 'Application Components', slug: 'guide/structure-application-components' },
            { label: 'Controllers', slug: 'guide/structure-controllers' },
            { label: 'Models', slug: 'guide/structure-models' },
            { label: 'Views', slug: 'guide/structure-views' },
            { label: 'Modules', slug: 'guide/structure-modules' },
            { label: 'Filters', slug: 'guide/structure-filters' },
            { label: 'Widgets', slug: 'guide/structure-widgets' },
            { label: 'Assets', slug: 'guide/structure-assets' },
            { label: 'Extensions', slug: 'guide/structure-extensions' },
          ],
        },
        {
          label: 'Handling Requests',
          items: [
            { label: 'Overview', slug: 'guide/runtime-overview' },
            { label: 'Bootstrapping', slug: 'guide/runtime-bootstrapping' },
            { label: 'Routing and URL Creation', slug: 'guide/runtime-routing' },
            { label: 'Requests', slug: 'guide/runtime-requests' },
            { label: 'Responses', slug: 'guide/runtime-responses' },
            { label: 'Sessions and Cookies', slug: 'guide/runtime-sessions-cookies' },
            { label: 'Handling Errors', slug: 'guide/runtime-handling-errors' },
            { label: 'Logging', slug: 'guide/runtime-logging' },
          ],
        },
        {
          label: 'Key Concepts',
          items: [
            { label: 'Components', slug: 'guide/concept-components' },
            { label: 'Properties', slug: 'guide/concept-properties' },
            { label: 'Events', slug: 'guide/concept-events' },
            { label: 'Behaviors', slug: 'guide/concept-behaviors' },
            { label: 'Configurations', slug: 'guide/concept-configurations' },
            { label: 'Aliases', slug: 'guide/concept-aliases' },
            { label: 'Class Autoloading', slug: 'guide/concept-autoloading' },
            { label: 'Service Locator', slug: 'guide/concept-service-locator' },
            { label: 'Dependency Injection Container', slug: 'guide/concept-di-container' },
          ],
        },
        {
          label: 'Working with Databases',
          items: [
            { label: 'Database Access Objects', slug: 'guide/db-dao' },
            { label: 'Query Builder', slug: 'guide/db-query-builder' },
            { label: 'Active Record', slug: 'guide/db-active-record' },
            { label: 'Migrations', slug: 'guide/db-migrations' },
          ],
        },
        {
          label: 'Getting Data from Users',
          items: [
            { label: 'Creating Forms', slug: 'guide/input-forms' },
            { label: 'Validating Input', slug: 'guide/input-validation' },
            { label: 'Uploading Files', slug: 'guide/input-file-upload' },
            { label: 'Collecting Tabular Input', slug: 'guide/input-tabular-input' },
            { label: 'Getting Data for Multiple Models', slug: 'guide/input-multiple-models' },
            { label: 'Extending ActiveForm on the Client Side', slug: 'guide/input-form-javascript' },
          ],
        },
        {
          label: 'Displaying Data',
          items: [
            { label: 'Data Formatting', slug: 'guide/output-formatting' },
            { label: 'Pagination', slug: 'guide/output-pagination' },
            { label: 'Sorting', slug: 'guide/output-sorting' },
            { label: 'Data Providers', slug: 'guide/output-data-providers' },
            { label: 'Data Widgets', slug: 'guide/output-data-widgets' },
            { label: 'Working with Client Scripts', slug: 'guide/output-client-scripts' },
            { label: 'Theming', slug: 'guide/output-theming' },
          ],
        },
        {
          label: 'Security',
          items: [
            { label: 'Overview', slug: 'guide/security-overview' },
            { label: 'Authentication', slug: 'guide/security-authentication' },
            { label: 'Authorization', slug: 'guide/security-authorization' },
            { label: 'Working with Passwords', slug: 'guide/security-passwords' },
            { label: 'Cryptography', slug: 'guide/security-cryptography' },
            { label: 'Best Practices', slug: 'guide/security-best-practices' },
          ],
        },
        {
          label: 'Caching',
          items: [
            { label: 'Overview', slug: 'guide/caching-overview' },
            { label: 'Data Caching', slug: 'guide/caching-data' },
            { label: 'Fragment Caching', slug: 'guide/caching-fragment' },
            { label: 'Page Caching', slug: 'guide/caching-page' },
            { label: 'HTTP Caching', slug: 'guide/caching-http' },
          ],
        },
        {
          label: 'RESTful Web Services',
          items: [
            { label: 'Quick Start', slug: 'guide/rest-quick-start' },
            { label: 'Resources', slug: 'guide/rest-resources' },
            { label: 'Controllers', slug: 'guide/rest-controllers' },
            { label: 'Filtering Collections', slug: 'guide/rest-filtering-collections' },
            { label: 'Routing', slug: 'guide/rest-routing' },
            { label: 'Response Formatting', slug: 'guide/rest-response-formatting' },
            { label: 'Authentication', slug: 'guide/rest-authentication' },
            { label: 'Rate Limiting', slug: 'guide/rest-rate-limiting' },
            { label: 'Versioning', slug: 'guide/rest-versioning' },
            { label: 'Error Handling', slug: 'guide/rest-error-handling' },
          ],
        },
        {
          label: 'Testing',
          items: [
            { label: 'Overview', slug: 'guide/test-overview' },
            { label: 'Testing environment setup', slug: 'guide/test-environment-setup' },
            { label: 'Unit Tests', slug: 'guide/test-unit' },
            { label: 'Functional Tests', slug: 'guide/test-functional' },
            { label: 'Acceptance Tests', slug: 'guide/test-acceptance' },
            { label: 'Fixtures', slug: 'guide/test-fixtures' },
          ],
        },
        {
          label: 'Special Topics',
          items: [
            { label: 'Building Application from Scratch', slug: 'guide/tutorial-start-from-scratch' },
            { label: 'Console Commands', slug: 'guide/tutorial-console' },
            { label: 'Core Validators', slug: 'guide/tutorial-core-validators' },
            { label: 'Docker', slug: 'guide/tutorial-docker' },
            { label: 'Internationalization', slug: 'guide/tutorial-i18n' },
            { label: 'Mailing', slug: 'guide/tutorial-mailing' },
            { label: 'Performance Tuning', slug: 'guide/tutorial-performance-tuning' },
            { label: 'Shared Hosting Environment', slug: 'guide/tutorial-shared-hosting' },
            { label: 'Template Engines', slug: 'guide/tutorial-template-engines' },
            { label: 'Working with Third-Party Code', slug: 'guide/tutorial-yii-integration' },
            { label: 'Using Yii as a micro framework', slug: 'guide/tutorial-yii-as-micro-framework' },
          ],
        },
        {
          label: 'Helpers',
          items: [
            { label: 'Overview', slug: 'guide/helper-overview' },
            { label: 'ArrayHelper', slug: 'guide/helper-array' },
            { label: 'Html', slug: 'guide/helper-html' },
            { label: 'Json', slug: 'guide/helper-json' },
            { label: 'Url', slug: 'guide/helper-url' },
          ],
        },
        {
          label: 'Glossary',
          items: [
            { label: 'Glossary', slug: 'guide/glossary' },
          ],
        },
        {
          label: 'Internals',
          autogenerate: { directory: 'internals' },
        },
      ],
    }),
  ],
});
