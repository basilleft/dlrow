# Website

Static website. Everything in `public/` is deployed to ALL-INKL via FTPS
on every push to `main` (see `.github/workflows/deploy.yml`).

## Structure

    public/            -> exactly what ends up on the web server
      index.html
      impressum.html
      datenschutz.html
      404.html
      css/style.css
      .htaccess        -> HTTPS redirect, security headers, caching
      robots.txt
    .github/workflows/ -> deploy pipeline

## One-time setup

1. **KAS → FTP:** create a new FTP user whose home directory is the
   website folder of your domain (not the account root!).
2. **GitHub → repo → Settings → Secrets and variables → Actions:** add
   - `FTP_HOST`: the server name shown in KAS (e.g. `wXXXXXXX.kasserver.com`)
   - `FTP_USER`: the new FTP user
   - `FTP_PASSWORD`: its password
3. **KAS → Domain:** enable the Let's Encrypt SSL certificate.

## Workflow

Edit files → commit → push to `main` → the site is live within about a minute.
Check progress under the repo's **Actions** tab.

**Warning:** the deploy uses `--delete`, so files on the server that are not
in `public/` will be removed. That's intended, but make sure the FTP user
only has access to this website's folder.

## Game

A small three.js jump-and-run lives in `public/game/` and is published at `/game/`.

- Try it locally: `python3 -m http.server 8000 --directory public`, then open
  http://localhost:8000/game/
- Run the tests: `node --test` (needs Node 20 or newer, no packages to install)
- Edit the level: the text grid `LEVEL_1` in `public/game/js/level.js`
- three.js is self-hosted in `public/game/vendor/`; see the README there for the version
