# Protein Viewer Website

A static website for searching and viewing protein structures by their four-character
PDB code. The site retrieves PDB/mmCIF structures from RCSB and renders them in the
browser with 3Dmol.js. When the PDB file is unavailable, it prefers RCSB's biological
assembly mmCIF so the viewer shows the biological unit rather than repeated crystal
copies. It has no application server, account system, or API key.

## Live site

<https://roshniks.github.io/protein-viewer/>

## Try it locally

Open `index.html` in a browser while connected to the internet. If the browser blocks
network requests from local files, serve this folder with a local static HTTP server
instead.

## Publish with GitHub Pages

GitHub Pages is currently available at no charge for public repositories. No hosting
provider can promise that its pricing or terms will remain unchanged forever.

1. Create a **public** GitHub repository for the website.
2. Upload the **contents of this folder** to the repository root. In particular,
   `.github/workflows/pages.yml` must be at the repository path
   `.github/workflows/pages.yml`, beside `index.html`.
3. In the repository, open **Settings → Pages** and set the build source to
   **GitHub Actions**.
4. Push to the `main` branch, or run **Deploy website to GitHub Pages** from the
   repository's **Actions** tab.
5. When the deployment workflow finishes, its summary contains the public URL.

To publish an update, commit and push the changed website files to `main`; GitHub
Actions will deploy them. Visitors receive the updated site on their next refresh.

The site source and bundled 3Dmol.js library are public. Protein structure data is
downloaded from RCSB when a visitor searches. An internet connection is required.

## Data source and third-party software

Protein structure files come from the RCSB Protein Data Bank:
<https://www.rcsb.org/>. The viewer uses the bundled 3Dmol.js library; its license
notices are in `THIRD_PARTY_NOTICES.txt`.
