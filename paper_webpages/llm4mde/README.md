# LLM4MDE research companion

Static companion pages for *LLMs for Model-driven Engineering: A Systematic Literature Review* (ACM TOSEM, DOI: 10.1145/3859883).

- `index.html`: paper overview, abstract, study collection, taxonomy, findings, and roadmap.
- `catalog.html`: searchable catalog of all 235 primary studies, with filters and CSV export.
- `assets/catalog-query.js`: search, dynamic field filters, and column selection. Changing Search in selects the corresponding columns while retaining ID, Year and Study; users can then customize Columns. Same-field values use Match any by default; multivalued classifications also support Match all. Different fields are combined with AND. Text conditions, year ranges, link presence, and metric-dimension filters are available. Query state is stored in URL parameters; existing catalog links remain supported.
- `assets/data.js`: study classifications and definitions drawn from the final submitted manuscript and public dataset.
- `assets/definitions.js`: paper-type and application-domain definitions from the submitted manuscript, plus the mapping from recorded domain labels to the manuscript's domain categories. Source hashes are recorded in `downloads/provenance.json`.
- `assets/findings.js` and `assets/findings-data.js`: interactive Findings charts rendered locally as proportional bars, with category tabs and enlarged views. No paper figure images are used in Findings.
- `downloads/`: original dataset, study ID–reference mapping, and source hashes.
- `assets/wselab-theme.css` and `assets/wselab-theme.js`: WSELab navigation, footer, typography, and colors, matching `../../mde-uncertainty.html`.

No build step is needed. From the repository root, run `python -m http.server 8001 --bind 127.0.0.1` and open http://127.0.0.1:8001/paper_webpages/llm4mde/.

Run `python paper_webpages/llm4mde/scripts/check_catalog.py` from the repository root to check overview tabs and chart counts, search/filter/column interactions, old and new URL formats, metadata display, and responsive layout in a temporary headless Edge session. The check requires Microsoft Edge on Windows and Python's `websocket-client`; it does not start a preview server.

The source data and figures were prepared in the LLM4MDE-Revision repository under `website/`, using `camera-ready/camera-ready-submitted` as the final manuscript source. The source paths in `downloads/provenance.json` refer to that research repository. Do not infer reference numbers from study IDs. Multi-label counts are not mutually exclusive.

All local links are relative, so these pages can be served under the existing ModelCopilot domain or GitHub Pages. The parent research page links to this companion through its “Explore the webpage” button.

Definition tabs follow manuscript order: paper types, MDE tasks, model types, application domains, and effectiveness metrics. Paper-type and domain counts cover all 235 studies; task and model-category cards retain their stated proposed-method/benchmarking scopes. The domain filter also retains categories with zero matching studies, so category links never silently fall back to an unfiltered catalog.

To regenerate and validate all 27 Findings charts, run `python scripts/build_findings.py --manuscript PATH/TO/camera-ready-submitted` from this directory. The script needs `pdftotext` on PATH and checks the dataset against the manuscript's generated figures, table citation sets, and reported totals before writing chart data. Source hashes are recorded in `downloads/findings-provenance.json`.

Findings follows the paper order: Bibliometric Analysis, Application Scope, Technical Characterization, and Benchmarking and Evaluation Practices. Bibliometric charts cover publication years, venues, venue types, and paper types across all 235 studies. Venue counts retain the manuscript table's venue-type grouping; 2025 is a partial year through October.

Chart scopes are explicit: application and technical analyses use 159 proposed-method studies; the enhancement figure excludes two upstream-only studies; coverage compares 159 proposed methods with 57 benchmarking and evaluation studies; effectiveness and replication analyses cover the full 235-study corpus. Named modeling languages exclude unspecified/N/A entries. All 31 named foundation model families are included. Long chart lists initially show 10 categories and can be expanded with Show all. Effectiveness charts cover scope, aspect, measurement, reference, perspective, and type; cost metrics and baselines cover all 235 studies. The aspect chart combines all scopes, deduplicating studies within each aspect and retaining the joint correctness-and-completeness row. Access-mode counts are study counts, including four studies using both API and Chat. No percentages are inferred from sums of overlapping counts.
