# Systematic Investigation into Quantum Optimization for Software Engineering

Website: [https://www.modelcopilot.org/paper_webpages/quantum_optimization_for_SE/](https://www.modelcopilot.org/paper_webpages/quantum_optimization_for_SE/)

A static GitHub Pages catalog merging the Survey Paper and Analysis Paper datasets by normalized paper title. The page presents publication cards, BibTeX, filters, summary charts, and merged analysis metadata with LaTeX rendering.

## Search and compare metadata

The catalog searches paper titles and the analysis metadata from both datasets. Enter a field name (for example, `baseline`) or a value (`QPSO`) to show matching papers with their corresponding metadata. Use **Search in** to select a specific field, or choose a category for publication context, SE activities and problems, optimization methods, platforms and backends, experimental settings, evaluation metrics, benchmarks and case studies, baselines, tools, or challenges. Categories search their related fields together and preserve the keyword and publication filters. Selecting a metadata field with an empty query lists studies reporting that field. Year, venue, optimization type, and venue type filters apply alongside the search.

The first two search scopes use cards. All other scopes use a comparison table with Title, Paper link, Year, Venue, and the selected metadata. Drag the right edge of any column header to resize that column, or focus the divider and use the left/right arrow keys. Widths persist during filtering and sorting within the page session. Tables default to oldest year first; the Year order selector switches to newest first. The metadata column includes the complete selected fields, even when only one value matched the keyword. BibTeX and analysis remain accessible from the title cell. Metadata is displayed as readable tags using source colors; values shared by both datasets use the shared-source color. With the default scope and an empty query, cards show only publication information and action buttons. **Clear search** resets the keyword and metadata scope while retaining the four publication filters.

The research overview summarizes each paper's abstract from the supplied PDFs. Both paper descriptions offer a read link and a BibTeX dialog with a copy button; citations use the survey DOI publication record and the analysis arXiv record. Live catalog counts describe the current datasets, which may differ from the study sets reported in the publications.

## Data and paper links

The two analysis datasets are loaded online; their source links are listed on the page. **Paper links come exclusively from `docs/paper_links.csv`.** The browser does not infer links from BibTeX or fetch the initial-search inventory.

The local CSV contains one row per study:

- `Paper ID`, `Title`, `Year`: identifiers and publication context. Matching uses `Title`, ignoring case and punctuation; IDs are retained for manual reference.
- `Link`: the actual paper URL used by both catalog cards and the analysis dialog. Leave it empty to display an unavailable link.
- `DOI`, `Source`, `Matched Title`, `Status`: curation provenance. These columns do not override `Link`.

Update the CSV to correct or add links. Keep normalized titles unique. Existing links were seeded from the initial-search dataset and source BibTeX; missing links were checked against Crossref, arXiv, or the conference proceedings. A publisher may restrict access even when a paper identifier is valid.

## Preview locally

Run from the repository root:

```bash
python -m http.server 8124
```

Open `http://127.0.0.1:8124/paper_webpages/quantum_optimization_for_SE/`. Use HTTP rather than opening the HTML through `file://`, because the page fetches CSV data. Internet access is needed for the online metadata and MathJax.

## Deploy on GitHub Pages

This page is part of the existing lab website, published from the repository root. Its independent entry is `paper_webpages/quantum_optimization_for_SE/index.html`, which redirects to `docs/` while preserving query parameters and section anchors. The local CSV and assets use relative URLs. No link from the lab homepage is required.

Pushing the `paper_webpage` branch uploads the changes for review. The page becomes public when these changes are included in the branch or workflow used by the existing GitHub Pages deployment. Keep the existing site publishing configuration; do not switch its source to this paper's `docs/` directory.

## Files

- `index.html`: independent directory entry for the paper page.
- `docs/index.html`: page and data-merging logic.
- `docs/paper_links.csv`: editable paper-link inventory.
- `docs/assets/css/style.css`: presentation.

## License

The contents of `docs/` retain the existing CC BY-SA 4.0 license; code retains the MIT license in `LICENSE`.

The study collection section summarizes database searching, screening, snowballing, and extraction from the survey methodology. `docs/assets/figs/method-diagram.pdf` is the supplied original diagram; `docs/assets/figs/method-diagram.png` is its web preview. Venue and SE activity charts count each merged study once per distinct reported value, combining both source rows.
