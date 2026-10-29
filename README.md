# Portfolio Cover Studio

[فارسی](README.fa.md)

### Website screenshots → consistent portfolio covers

A portfolio cover maker for freelancers, web designers, and developers who want to present their projects with a consistent visual style.

## Why I built this

I'm a freelancer, and I needed a better way to showcase the websites I had built.

For every project, I wanted a distinctive cover that followed the same visual template—something that would make my work look more polished and professional on freelance marketplaces.

Recreating that layout manually for every project was repetitive. I wanted to replace the screenshots, update the project details, and create a new cover without starting from scratch.

That's why I built Portfolio Cover Studio. I'm sharing it as an open-source tool for other freelancers who need the same thing.

## What it does

Combine website screenshots, project details, technology icons, and your own branding into portfolio presentation images. Keep a consistent layout while customizing each project.

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

If your MySQL setup needs a password or custom connection details, copy `api/config.local.php.example` to `api/config.local.php` and edit the local file. It is ignored by Git. Then run both the PHP API and Vite:

```bash
npm run dev
```

The app stores projects and image assets in MySQL and keeps a local IndexedDB cache. Images are handled by your own local setup; the included development API listens on `127.0.0.1`.

To build the app:

```bash
npm run build
```

See [README.fa.md](README.fa.md) for the full Persian guide.

---

Created by a freelancer, for freelancers.

[Creator's website](https://webzad.ir)
