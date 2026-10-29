# Portfolio Cover Studio

[فارسی](README.fa.md)

### Turn website screenshots into consistent portfolio covers

A browser based tool for freelancers, web designers, and developers who want to present their projects with a consistent visual style.

## Why I built this

I'm a freelancer, and I needed a better way to showcase the websites I had built. I wanted every project to have its own cover while following a shared layout, so my portfolio would look polished without rebuilding the design from scratch each time.

I'm sharing Portfolio Cover Studio as an open-source tool for other freelancers who need the same thing.

## What it does

Combine website screenshots, project details, technology icons, and your own branding into a portfolio image. Customize the layout while keeping a consistent style across projects.

Two templates are available:

- **Web portfolio cover:** 1080 × 848
- **Social media cover:** 1080 × 1080 (1:1)

Both use the same editor, image handling, and PNG/WebP export flow.

## Who it's for

- Freelancers showcasing completed projects
- Web designers presenting website designs
- Developers building a visual portfolio
- Creative studios maintaining a consistent presentation style

## Use cases

- Project covers for freelance marketplaces
- Website design portfolio thumbnails
- Project showcase images for personal websites
- Visual presentations of completed client work

## Getting started

Requirements: Node.js 20.19+ (or 22.12+), npm, PHP CLI with `pdo_mysql`, and a local MySQL server. Laragon is supported.

```bash
npm install
```

If your MySQL setup needs a password or custom connection details, copy `api/config.local.php.example` to `api/config.local.php` and edit the local file. It is ignored by Git. Then start the local PHP API and Vite:

```bash
npm run dev
```

In PowerShell, use `npm.cmd run dev` if the `npm` command is blocked by the current execution policy. The development API listens on `127.0.0.1:8787`.

Projects, brand settings, and image assets are stored in MySQL, with a local IndexedDB cache. For the schema, template layout decisions, and instructions for adding another template, see the [architecture and templates guide](./داکیومنت/راهنمای-معماری-و-قالب‌ها.md).

To build the app:

```bash
npm run build
```

---

Created by a freelancer, for freelancers.

[Creator's website](https://webzad.ir)
