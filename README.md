# Deedz the Goose: Honk Commander

A GitHub-ready browser platformer prototype inspired by classic Commander Keen-style platform adventures.

## Features

- Deployable HTML/CSS/JavaScript project
- Dynamic procedural platform levels
- Trampolines/springs for high jumps
- Moving platforms
- Fun props: signs, mushrooms, crates, flags, satellite dishes
- Deedz goose character
- Black cat companion that collects nearby coins
- Honk shockwave
- Stick attack
- Dash
- Breadcrumb projectile
- Triple-jump feather unlock
- Boss fight
- Browser synth music and sound effects

## Controls

| Action | Key |
|---|---|
| Move | A/D or Arrow Left/Right |
| Jump | Space, W, or Arrow Up |
| Dash | Shift |
| Honk | H |
| Stick swing | J |
| Throw breadcrumb | K |
| Start/restart | Enter or button |

## Run locally

Use any static file server.

### Python

```bash
python -m http.server 5173
```

Then open:

```text
http://localhost:5173
```

### VS Code

Install the **Live Server** extension, then right-click `index.html` and choose **Open with Live Server**.

## Push to GitHub

```bash
git init
git add .
git commit -m "Initial Deedz the Goose browser game"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/deedz-the-goose.git
git push -u origin main
```

## Deploy

This project is static and can deploy to:

- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages
- Fly.io static server

## Next upgrades

- JSON level editor
- Real art asset pipeline
- Save files/localStorage unlocks
- Gamepad polish
- Bigger boss attacks
- More Keen-style doors, keys, secret rooms, collectibles
- Enemy patrol zones
- Parallax biome system
