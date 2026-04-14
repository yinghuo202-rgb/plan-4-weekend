# Weekend Wheel

Lightweight static web app for weekend planning.

This project is ready for GitHub Pages.

## Files

- `index.html`: main wheel page
- `settings.html`: settings page
- `styles.css`: shared styles
- `storage.js`: local storage and default data
- `wheel.js`: wheel rendering and selection logic
- `app.js`: main page interactions
- `settings.js`: settings page interactions

## Deploy To GitHub Pages

1. Create a new public GitHub repository.
2. Upload all files in this folder to the repository root.
3. Use `main` as the default branch.
4. Push the branch and wait for the `Deploy GitHub Pages` workflow to finish.
5. In `Settings -> Pages`, make sure the source is `GitHub Actions`.

Your site URL will look like:

`https://your-user-name.github.io/your-repo-name/`

Your settings page URL will look like:

`https://your-user-name.github.io/your-repo-name/settings.html`

## Local Preview

Open `index.html` directly, or run:

```powershell
npx -y http-server . -p 4173 -c-1
```

Then open:

`http://127.0.0.1:4173/`
