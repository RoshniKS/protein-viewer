# Protein Viewer Website

A static website for searching and viewing protein structures by their four-character
PDB code. The site retrieves PDB/mmCIF structures from RCSB and renders them in the
browser with 3Dmol.js. When the PDB file is unavailable, it prefers RCSB's biological
assembly mmCIF so the viewer shows the biological unit rather than repeated crystal
copies. It has no application server, account system, or API key.

## Live site

<https://roshniks.github.io/protein-viewer/>

The site source and bundled 3Dmol.js library are public. Protein structure data is
downloaded from RCSB when a visitor searches. An internet connection is required.

## Data source and third-party software

Protein structure files come from the RCSB Protein Data Bank:
<https://www.rcsb.org/>. The viewer uses the bundled 3Dmol.js library; its license
notices are in `THIRD_PARTY_NOTICES.txt`.
