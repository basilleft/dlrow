# CLAUDE.md – Project handover

## Goal

Replace a very old website hosted at ALL-INKL.COM with a fresh, modern setup
managed in Git. The old content is NOT needed and will be deleted by the first
deploy. Start simple (plain static site), grow later.

## Current setup

- **Domain:** www.dlrow.de
- **Hosting:** ALL-INKL.COM, tariff **PrivatPlus**, managed via KAS (https://kas.all-inkl.com).
- **No SSH** on this tariff (SSH starts at the Premium tariff). Deploys therefore use
  **FTPS** (FTP over TLS), not rsync/SFTP.
- **Repository:** GitHub (`basilleft/dlrow`). CI/CD: GitHub Actions.
- **Site type:** plain static HTML/CSS. No build step and no framework. Node.js is used only to run the game's tests locally, never in the deploy.
- **Audience / language:** German site (`lang="de"`). Owner is based in Germany.

## Repository structure

```
public/              -> exactly what is uploaded to the web server
  index.html         -> "coming soon" placeholder
  impressum.html     -> legal notice, PLACEHOLDER content (required in Germany)
  datenschutz.html   -> privacy policy, PLACEHOLDER content (required in Germany)
  404.html           -> custom error page (wired via .htaccess)
  css/style.css      -> single stylesheet, CSS variables, light + dark mode
  .htaccess          -> HTTPS redirect, security headers, caching, Options -Indexes
  robots.txt
  game/              -> three.js platformer test game, live at /game/ (not linked from the start page)
    index.html, game.css
    js/              -> boot + gate (access code), level, physics, player, enemy, game (rules,
                        no three.js) + input, hud, render, character, main
    vendor/          -> self-hosted three.js 0.187.0 (unmodified) + LICENSE
tests/               -> Node tests for the game rules (`node --test`), never deployed
package.json         -> only "type": "module" and the test script; NO dependencies
docs/superpowers/    -> design specs and implementation plans
.github/workflows/deploy.yml -> deploy on push to main (+ manual workflow_dispatch)
README.md, .gitignore, .editorconfig
```

## Deployment

- Trigger: push to `main` (or manual run in the Actions tab).
- Runs `lftp mirror --reverse --delete` of `public/` to `/` of the deploy FTP user,
  with `ftp:ssl-force`, `ftp:ssl-protect-data` and certificate verification on.
- Secrets in GitHub (Settings → Secrets and variables → Actions):
  - `FTP_HOST` – the ALL-INKL server name from the FTP user's info button
    (`wXXXXXXX.kasserver.com` style). Must NOT be the domain, or TLS verification fails.
  - `FTP_USER` – dedicated deploy FTP user (not the main user `w015acbf`).
  - `FTP_PASSWORD` – its password. Must not contain a comma (lftp `-u user,pass` syntax).
    Improvement option: switch to `lftp --env-password` with `LFTP_PASSWORD` to remove
    this restriction.

### Critical safety rules

- `--delete` removes every file on the server that is not in `public/`. The deploy FTP
  user's home directory MUST be the website folder only, never the webspace root `/`.
  The main FTP user has `/` as its directory and must never be used in CI.
- Never commit credentials, `.env` files or FTP passwords. Secrets live only in GitHub.
- Do not change the deploy target path or remove `--delete` without telling the owner.

## Status

Done:
- [x] Starter project created (files above)
- [x] Deploy workflow written
- [x] Backup of the old site taken via FTP (owner confirmed 2026-11-26)
- [x] Domain's target folder checked in KAS → Domain (owner confirmed 2026-11-26)
- [x] Dedicated deploy FTP user created with that folder as its path (owner confirmed 2026-11-26)
- [x] Let's Encrypt enabled (owner confirmed 2026-11-26)
- [x] Three GitHub secrets added, deploys live: Actions runs green, site serves
      over HTTPS with security headers, HTTP redirects to HTTPS (verified 2026-11-26)

Open: nothing — setup is complete. See next steps below.

## Open decisions / next steps

1. Fill `impressum.html` and `datenschutz.html` with real data (owner provides details;
   Claude is not a lawyer, recommend a generator such as e-recht24 or legal advice).
2. Replace the placeholder email `info@example.de` everywhere.
3. Define what the site is actually about, then design real content.
4. Optionally migrate to a static site generator (Astro or Hugo) once the site grows:
   add a build step in the workflow and deploy the build output folder instead of `public/`.
5. After HTTPS works reliably for a while: enable HSTS (commented line in `.htaccess`,
   or KAS's own HSTS option – not both).

## Conventions

- Keep it dependency-free unless a framework is explicitly agreed. Agreed so far:
  three.js for `public/game/`, self-hosted in `public/game/vendor/` (no npm install, no CDN).
- Game code: only `public/game/js/render.js` and `public/game/js/character.js` import
  three.js. Game rules stay free of
  three.js and the DOM so they can be tested with `node --test`. Run the tests before
  every commit that touches `public/game/js/`.
- The game page asks for an access code (`public/game/js/gate.js`, UI in `boot.js`). It is a
  courtesy lock only: the check runs in the browser and the repo is public, so it does not
  protect the files. Only the hash is stored; never write the code itself into the repo
  (code, tests, docs, commit messages). Real protection would need server-side Basic Auth
  with the password file outside the deployed folder.
- ES modules do not load from `file://`. To try the site locally:
  `python3 -m http.server 8000 --directory public`, then open http://localhost:8000/game/.
- No third-party requests (no Google Fonts, CDNs, analytics, embeds) without discussing
  GDPR implications first. Fonts are system fonts; self-host any custom font.
- Accessible by default: semantic HTML, visible focus states, good contrast,
  responsive down to mobile, light and dark mode via CSS variables.
- Small, focused commits; work on branches and merge to `main` to deploy.
