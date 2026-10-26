"""Build auditable chart data; validate study counts against the submitted paper.

Usage: python scripts/build_findings.py --manuscript PATH/TO/camera-ready-submitted
Requires pdftotext (TeX Live/Poppler) for independent checks of source figures.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import subprocess

SITE = Path(__file__).resolve().parents[1]


def normalize(value):
    return re.sub(r"\s+", " ", value.replace("\u2212", "-")).strip().casefold()


def build(source):
    used = {}

    def read(name):
        path = source / name
        used[name] = hashlib.sha256(path.read_bytes()).hexdigest()
        return path.read_text(encoding="utf-8")

    def pdf_bars(name):
        path = source / name
        used[name] = hashlib.sha256(path.read_bytes()).hexdigest()
        text = subprocess.check_output(["pdftotext", "-layout", str(path), "-"], encoding="utf-8")
        return {normalize(m[1]): int(m[2]) for line in text.splitlines()
                if (m := re.match(r"^\s*([A-Za-z0-9][A-Za-z0-9 /()#.%+\-\u2212]*?)\s{2,}(\d+)\s*$", line)) and re.search(r"[A-Za-z]", m[1])}

    data_text = (SITE / "assets/data.js").read_text(encoding="utf-8")
    data = json.loads(data_text.split("window.LLM4MDE_DATA = ", 1)[1].strip().removesuffix(";"))
    studies = data["studies"]
    proposed = [s for s in studies if s["paperType"] == "Proposed method"]
    benchmarks = [s for s in studies if s["paperType"] == "Benchmarking and evaluation"]
    assert (len(studies), len(proposed), len(benchmarks)) == (235, 159, 57)
    by_key = {s["key"]: s["id"] for s in studies}
    content = read("content.tex")
    macros = dict(re.findall(r"\\newcommand\{\\(paper[^}]+)\}\{([^}]+)\}", read("generated_files/collection_statistics.tex")))

    def cited_ids(text):
        ids = set()
        for citation in re.findall(r"\\cite\{([^}]+)\}", text):
            for ref in citation.split(","):
                ref = ref.strip()
                key = macros[ref[1:]] if ref.startswith("\\") else ref
                ids.add(by_key[key])
        return ids

    def facet_counts(cohort, field):
        return Counter(value for s in cohort for value in set(s["facets"][field]))

    def rows(counts):
        return [{"label": label, "values": [count]} for label, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))]

    charts = {"bibliometric": [], "scope": [], "technical": [], "evaluation": []}

    def chart(part, key, tab, title, scope, note, source_label, values, series=None, limit=10):
        charts[part].append({"id": key, "tab": tab, "title": title, "scope": scope,
                            "note": note, "source": source_label, "series": series or ["Studies"],
                            "rows": values, "previewRows": limit})

    years = Counter(s["year"] for s in studies)
    year_path = source / "generated_files/RQ1_plot_num_publications_over_year.pdf"
    used["generated_files/RQ1_plot_num_publications_over_year.pdf"] = hashlib.sha256(year_path.read_bytes()).hexdigest()
    year_figure = subprocess.check_output(["pdftotext", "-layout", str(year_path), "-"], encoding="utf-8")
    assert years == {2021: 1, 2022: 5, 2023: 26, 2024: 84, 2025: 119}
    assert all(re.search(r"\b" + str(count) + r"\b", year_figure) for count in years.values())
    assert "2017" in year_figure and "Oct" in year_figure
    chart("bibliometric", "years", "Publication years", "Publications by year", "235 primary studies; collection updated in October 2025",
          "Publication years span the search period from 2017 to October 2025. The 2025 count covers only the period through October.",
          "Paper: number of publications by year", [{"label": "2025 (through October)" if year == 2025 else str(year), "values": [years[year]]} for year in range(2017, 2026)])

    venue_types = Counter(s["venueType"].strip() for s in studies)
    paper_types = Counter(s["paperType"] for s in studies)
    assert venue_types == {"Conference": 147, "Workshop": 49, "Journal": 39}
    assert paper_types == {"Proposed method": 159, "Benchmarking and evaluation": 57, "New idea or vision": 15, "Tool demo": 4}
    assert "147 out of" in content and "49 in workshops and 39 in journals" in content
    assert all(text in content for text in ["159 primary studies", "15 (6.38", "57 (24.26", "4 (1.70"])

    def venue_key(name):
        name = re.sub(r"\s*\([^)]*\)", "", name)
        return normalize(name.replace("International Conference on Process Mining Workshops", "Process Mining Workshops"))

    recorded_venues = Counter((venue_key(s["venue"]), s["venueType"].strip()) for s in studies)
    venue_rows, named_totals, other_totals = [], Counter(), {}
    for line in read("generated_files/RQ2_venue.tex").splitlines():
        match = re.match(r"\d+\s*&\s*\\emph\{([^}]+)\}\s*&\s*(\d+)\s*&\s*(Conference|Journal|Workshop)", line)
        if not match:
            continue
        name, count, venue_type = match[1], int(match[2]), match[3]
        if name.startswith("Other "):
            other_totals[venue_type] = count
            label = "Other " + venue_type.lower() + " venues"
        else:
            assert recorded_venues[venue_key(name), venue_type] == count, name
            named_totals[venue_type] += count
            acronym = re.search(r"\(([^)]+)\)", name)
            label = acronym[1] if acronym else name
            if ": Companion Proceedings" in name:
                label += " Companion"
            elif name.endswith(" Workshops"):
                label += " Workshops"
        venue_rows.append({"label": label, "fullName": name + " (" + venue_type + ")", "values": [count]})
    assert len(venue_rows) == 18 and sum(row["values"][0] for row in venue_rows) == 235
    assert all(named_totals[k] + other_totals[k] == count for k, count in venue_types.items())
    chart("bibliometric", "venues", "Venues", "Publication venues", "235 primary studies",
          "Venues with at least three studies are listed individually by venue type. Remaining venues are grouped as Other conference, journal, or workshop venues, following the paper.",
          "Paper: number of publications per venue", venue_rows)
    chart("bibliometric", "venue-types", "Venue types", "Publication venue types", "235 primary studies",
          "Each study is assigned to one venue type; counts sum to 235.",
          "Paper: publication venue and paper types", rows(venue_types))
    chart("bibliometric", "paper-types", "Paper types", "Types of research contributions", "235 primary studies",
          "Each study is classified by its primary contribution. The 159 proposed-method studies form the cohort for application scope and technical characterization.",
          "Paper: publication venue and paper types", rows(paper_types))

    tasks = facet_counts(proposed, "tasks")
    paper_tasks = pdf_bars("generated_files/RQ5_MDE_tasks.pdf")
    assert len(tasks) == len(paper_tasks) == 24
    assert {normalize(k): v for k, v in tasks.items()} == paper_tasks
    chart("scope", "tasks", "MDE tasks", "MDE tasks addressed by proposed methods", "159 proposed-method studies",
          "Distinct studies per task. A study can address more than one task; bars are not additive.",
          "Paper: application scope, MDE-task distribution", rows(tasks))

    def grouped_table(filename):
        groups, entries = {}, {}
        current = None
        for line in read("generated_files/" + filename).splitlines():
            cells = line.split("&")
            if len(cells) != 4 or not cited_ids(line):
                continue
            if (m := re.search(r"([A-Za-z -]+)\s*\(\{?(\d+)\}?\)", cells[0])):
                current = m[1].strip()
                groups[current] = {"count": int(m[2]), "ids": set()}
            ids = cited_ids(line)
            assert current and len(ids) == int(cells[2].strip().strip("{}"))
            groups[current]["ids"].update(ids)
            label = re.search(r"\\emph\{([^}]+)\}", cells[1])[1]
            entries.setdefault(label, set()).update(ids)
        for group in groups.values():
            assert len(group["ids"]) == group["count"]
        return groups, entries

    activities, se_tasks = grouped_table("RQ5_se.tex")
    activity_aliases = {"SE Models And Methods": "Software Engineering Models and Methods", "SE Management": "Software Engineering Management"}
    activity_counts = {activity_aliases.get(k, k): v["count"] for k, v in activities.items()}
    assert activity_counts == facet_counts(proposed, "activities")
    se_tasks.pop("-")  # General modeling work has no specific SE task in the paper.
    assert {normalize(k): len(v) for k, v in se_tasks.items()} == {normalize(k): v for k, v in facet_counts(proposed, "seTasks").items()}
    chart("scope", "se-activities", "SE activities", "Software engineering activities", "159 proposed-method studies",
          "Distinct studies per SE activity. A study may address several activities.",
          "Paper: SE activities and tasks", rows(activity_counts))
    chart("scope", "se-tasks", "SE tasks", "Software engineering tasks", "159 proposed-method studies",
          "Distinct studies per named SE task. General modeling work without a specific SE task is excluded. A study may address multiple tasks.",
          "Paper: SE activities and tasks", rows({k: len(v) for k, v in se_tasks.items()}))
    charts["scope"].append(charts["scope"].pop(0))

    categories = facet_counts(proposed, "categories")
    assert categories == Counter({c["name"]: c["count"] for c in data["categories"]})
    table = read("generated_files/RQ4_model_type_category.tex")
    # The generated category table lists the cited studies behind each category.
    source_categories = {}
    current = None
    for line in table.splitlines():
        if (m := re.match(r"^([A-Za-z /]+)\s+\((\d+)\)\s*&", line)):
            current = m[1].strip()
            source_categories[current] = {"count": int(m[2]), "ids": set(), "types": []}
        if current:
            source_categories[current]["ids"].update(cited_ids(line))
            cells = line.split("&")
            if len(cells) == 4 and cited_ids(line):
                label = re.search(r"\\emph\{([^}]+)\}", cells[1])[1]
                count = int(cells[2].strip())
                assert count == len(cited_ids(line))
                dataset_ids = {s["id"] for s in proposed if any(normalize(t) == normalize(label) for t in s["facets"]["modelTypes"])}
                assert dataset_ids == cited_ids(line), label
                source_categories[current]["types"].append({"label": label, "values": [count]})
    for name, count in categories.items():
        assert source_categories[name]["count"] == len(source_categories[name]["ids"]) == count, name
    model_rows = rows(categories)
    for row in model_rows:
        row["children"] = source_categories[row["label"]]["types"]
        assert row["children"]
    chart("scope", "models", "Model types", "Model type categories", "159 proposed-method studies",
          "Expand a category to see its model types. All bars use the same scale and count distinct studies. A study may use several types, so type counts do not necessarily sum to the category total.",
          "Paper: model type category distribution", model_rows)

    languages = facet_counts(proposed, "languages")
    languages.pop("Unspecified", None)
    paper_languages = pdf_bars("generated_files/RQ4_modeling_language.pdf")
    paper_languages.pop("n/a", None)
    assert {normalize(k): v for k, v in languages.items()} == paper_languages
    language_legend = content.split("\\textit{DSL}: Domain-specific Language;", 1)[1].split("\\par}", 1)[0]
    language_names = dict(re.findall(r"\\textit\{([^}]+)\}:\s*([^;\n]+)", language_legend))
    language_names = {name: full.strip().rstrip(".") for name, full in language_names.items()}
    language_names.update({"DSL": "Domain-specific Language", "SysML v1": language_names["SysML"] + " (version 1)",
                           "Ecore": "Ecore", "Petri Net": "Petri Net", "Simulink": "Simulink"})
    language_rows = rows(languages)
    for row in language_rows:
        row["fullName"] = language_names[row["label"]]
    chart("scope", "languages", "Modeling languages", "Modeling languages", "159 proposed-method studies",
          "Distinct studies per modeling language. Studies may use multiple languages.",
          "Paper: modeling-language distribution", language_rows)

    domain_text = read("generated_files/RQ7_application_domain.tex")
    domains = {}
    for line in domain_text.splitlines():
        if (m := re.match(r"\s*([A-Za-z /-]+)\s*&\s*\{?(\d+)\}?\s*&", line)):
            assert len(cited_ids(line)) == int(m[2]), m[1]
            domains[m[1].strip()] = int(m[2])
    assert sum(domains.values()) == 159 and domains["General Systems"] == 135
    chart("scope", "domains", "Application domains", "Application domains of proposed methods", "159 proposed-method studies",
          "The paper's grouped domain counts for proposed methods. General Systems denotes domain-agnostic work.",
          "Paper: application domains of LLM-based MDE solutions", rows(domains))

    llms = facet_counts(proposed, "llms")
    llms.pop("Unspecified")
    source_llms = {}
    for line in read("generated_files/RQ8_llm_version_size.tex").splitlines():
        if "&" in line and cited_ids(line):
            source_llms[line.split("&")[0].strip()] = len(cited_ids(line))
    assert llms == source_llms and len(llms) == 31
    chart("technical", "llms", "Foundation models", "Foundation model families", "159 proposed-method studies",
          "All 31 named model families. Versions within a family are deduplicated per study; a study may use several families. Five studies do not specify a family.",
          "Paper: foundation model families and versions", rows(llms))

    prompts = Counter()
    for study in proposed:
        terms = {term.strip() for combo in study["facets"]["prompting"] for term in combo.split("+")}
        terms = {"Iterative" if term.startswith("Iterative(") else term for term in terms}
        prompts.update(terms - {"Unspecified"})
    assert [prompts[k] for k in ["Zero-shot", "Few-shot", "Role", "Chain-of-thought", "Iterative", "Prompt Chaining"]] == [73, 57, 30, 28, 26, 21]
    read_prompt = source / "generated_files/RQ9_prompt_technique_complex_upset.pdf"
    used["generated_files/RQ9_prompt_technique_complex_upset.pdf"] = hashlib.sha256(read_prompt.read_bytes()).hexdigest()
    prompt_pdf = subprocess.check_output(["pdftotext", "-layout", str(read_prompt), "-"], encoding="utf-8")
    prompt_aliases = {"Zeroshot": "Zero-shot", "Fewshot": "Few-shot", "Role": "Role", "COT": "Chain-of-thought", "Iterative": "Iterative", "PromptChaining": "Prompt Chaining", "Oneshot": "One-shot", "SelfRefine": "Self-Refine", "TOT": "Tree-of-Thoughts", "SelfConsistency": "Self-Consistency", "Negative": "Negative", "GrammarPrompting": "Grammar prompting", "Style": "Style", "SCOT": "Structured Chain-of-thought", "LeasttoMost": "Least-to-Most", "Decomposed": "Decomposed"}
    source_prompts = {prompt_aliases[m[2]]: int(m[1]) for line in prompt_pdf.splitlines() if (m := re.match(r"^\s*(\d+)\s+([A-Za-z]+)\s*$", line)) and m[2] in prompt_aliases}
    assert prompts == source_prompts
    chart("technical", "prompting", "Prompting", "Prompt engineering techniques", "159 proposed-method studies",
          "Individual techniques are counted once per study, including within combinations.",
          "Paper: prompting-technique totals from the intersection plot", rows(prompts))

    task_specific = [s for s in proposed if s["facets"]["tasks"]]
    enhancement = facet_counts(task_specific, "enhancement")
    assert enhancement == {"Fine-tuning": 21, "RAG": 15, "Multi-agent": 3, "Knowledge base": 2, "Pre-training": 2, "Instruction tuning": 1}
    assert sum(bool(s["facets"]["enhancement"]) for s in proposed) == 42
    assert sum(bool(s["facets"]["enhancement"]) for s in task_specific) == 40
    assert "two studies are excluded because they address upstream activities" in content
    chart("technical", "enhancement", "Enhancement", "LLM enhancement techniques", "Task-specific proposed methods; two upstream-only studies excluded",
          "Matches the paper's enhancement figure: 21 fine-tuning and 15 RAG studies. There are 42 enhanced-method studies overall; the figure excludes two upstream-only studies. A study may use multiple enhancement techniques.",
          "Paper: enhancement techniques by MDE task", rows(enhancement))

    pipeline = facet_counts(proposed, "pipeline")
    access = facet_counts(proposed, "access")
    assert access == {"API": 131, "Chat": 23, "Unspecified": 9}
    assert "127+4=131" in content and "19+4=23" in content
    assert sum({"API", "Chat"}.issubset(s["facets"]["access"]) for s in proposed) == 4
    chart("technical", "access", "Access mode", "Modes of accessing LLMs", "159 proposed-method studies",
          "API and Chat count distinct studies, including four using both. Nine studies do not specify an access mode.",
          "Paper: LLM access modes", rows(access))
    assert pipeline == {"Single LLM": 114, "Same LLM in pipeline": 43, "Different LLMs in pipeline": 2}
    chart("technical", "pipeline", "LLM architectures", "Composition of LLM pipelines", "159 proposed-method studies",
          "The three architecture categories partition the proposed-method studies.",
          "Paper: distribution of LLM uses in proposed solutions", rows(pipeline))

    interactions = facet_counts(proposed, "interaction")
    interactions.pop("Unspecified", None)
    hitl = read("generated_files/RQ12_human_in_the_loop_summary.tex")
    for label, count in interactions.items():
        match = next(line for line in hitl.splitlines() if normalize(label).replace("-", "") in normalize(re.sub(r"\\emph\{([^}]+)\}", r"\1", line)).replace("-", ""))
        assert int(match.split("&")[1].strip()) == count
    assert sum(bool(set(s["facets"]["interaction"]) - {"Unspecified"}) for s in proposed) == 25
    chart("technical", "human", "Human involvement", "Human-in-the-loop interaction patterns", "25 studies with explicit human involvement",
          "Counts cover the four reported patterns. One study uses both feedback-based refinement and manual editing, so the bars total 26.",
          "Paper: human-in-the-loop interaction patterns", rows(interactions))

    benchmark_tasks = facet_counts(benchmarks, "tasks")
    coverage = read("generated_files/RQ13_proposed_vs_benchmark_mde_task_coverage.tex")
    coverage_rows = []
    for line in coverage.splitlines():
        parts = line.split("&")
        if len(parts) == 3 and parts[0].strip().startswith("Model"):
            name = parts[0].strip()
            assert (tasks[name] > 0) == ("checkmark" in parts[1])
            assert (benchmark_tasks[name] > 0) == ("checkmark" in parts[2])
            coverage_rows.append({"label": name, "values": [tasks[name], benchmark_tasks[name]]})
    assert len(coverage_rows) == 25 and len(benchmark_tasks) == 10
    chart("evaluation", "coverage", "MDE task coverage", "MDE task coverage by study type", "159 proposed-method studies and 57 benchmarking and evaluation studies",
          "Distinct study counts derived from the dataset; task presence is checked against the paper's coverage table (24 versus 10 task types). Cohort sizes differ, and a study can address several tasks.",
          "Paper: MDE task coverage table; counts from the study dataset", coverage_rows, ["Proposed methods", "Benchmarking and evaluation"])

    metric_groups = {}
    for filename in ["RQ13_metrics_semantic.tex", "RQ13_metrics_nonsemantic.tex"]:
        text = read("generated_files/" + filename)
        scope = aspect = None
        for line in text.splitlines():
            parts = line.split("&", 2)
            if len(parts) != 3:
                continue
            if (m := re.search(r"([A-Za-z+]+)\s*\((\d+)\)", parts[0])):
                scope = m[1]
                metric_groups.setdefault(scope, {"count": int(m[2]), "aspects": {}, "ids": set()})
            if not scope:
                continue
            if (m := re.search(r"([A-Za-z+ -]+)\s*\((\d+)\)", parts[1])):
                aspect = m[1].strip()
                metric_groups[scope]["aspects"][aspect] = {"count": int(m[2]), "ids": set()}
            ids = cited_ids(line)
            metric_groups[scope]["ids"].update(ids)
            if aspect:
                metric_groups[scope]["aspects"][aspect]["ids"].update(ids)
    for group in metric_groups.values():
        assert len(group["ids"]) == group["count"]
        for aspect in group["aspects"].values():
            assert len(aspect["ids"]) == aspect["count"]
    chart("evaluation", "metric-scopes", "Metric scopes", "Scopes of effectiveness metrics", "235 primary studies",
          "Distinct studies listed in the paper's metric tables. Semantic-syntactic denotes metrics that combine both scopes; studies may appear in multiple bars.",
          "Paper: semantic and nonsemantic effectiveness-metric tables", rows({"Semantic": metric_groups["Semantic"]["count"], "Syntactic": metric_groups["Syntactic"]["count"], "Semantic-syntactic": metric_groups["Sem+Syn"]["count"]}))
    aspect_names = list(dict.fromkeys(name for group in metric_groups.values() for name in group["aspects"]))
    aspect_rows = [{"label": name, "values": [len(set().union(*(group["aspects"].get(name, {}).get("ids", set())
                                                              for group in metric_groups.values())))]} for name in aspect_names]
    chart("evaluation", "quality-aspects", "Quality aspects", "Quality aspects assessed by effectiveness metrics", "235 primary studies",
          "Distinct studies per aspect across all scopes, counting each study once per aspect. Correctness + Completeness retains metrics assessing both jointly as a separate row. A study may appear in several aspects.",
          "Paper: effectiveness-metric tables", aspect_rows)

    dimensions = {"Measurement": {}, "Reference": {}, "Perspective": {}, "Type": {}}
    all_metric_ids = set().union(*(g["ids"] for g in metric_groups.values()))
    for filename in ["RQ13_metrics_semantic.tex", "RQ13_metrics_nonsemantic.tex"]:
        for line in read("generated_files/" + filename).splitlines():
            ids = cited_ids(line)
            if not ids:
                continue
            labels = re.findall(r"\\colorbox\[HTML\]\{[^}]+\}\{([^}]+)\}", line)
            assert len(labels) == 3
            for dimension, label in zip(["Measurement", "Perspective", "Reference"], labels):
                label = {"Ref-based": "Reference-based", "Ref-free": "Reference-free"}.get(label, label)
                dimensions[dimension].setdefault(label, set()).update(ids)
            chunks = re.split(r"\\textcircled\{\d+\}\s*\\textbf\{([^}]+)\}:", line)
            if len(chunks) == 1:
                assert labels[0] == "Qualitative" and "rating" in line.lower()
                dimensions["Type"].setdefault("Rating-based metrics", set()).update(ids)
            else:
                typed_ids = set()
                for label, metrics in zip(chunks[1::2], chunks[2::2]):
                    label = label.replace(r"Model related \#/\% metrics", "Model #/% metrics")
                    category_ids = cited_ids(metrics)
                    dimensions["Type"].setdefault(label, set()).update(category_ids)
                    typed_ids.update(category_ids)
                assert typed_ids == ids
    for dimension, groups in dimensions.items():
        assert set().union(*groups.values()) == all_metric_ids
        chart("evaluation", "metric-" + dimension.lower(), dimension, dimension + " of effectiveness metrics", "235 primary studies",
              "Distinct studies classified from the effectiveness-metric tables. A study can report metrics in more than one category.",
              "Paper: effectiveness-metric classification", rows({k: len(v) for k, v in groups.items()}))

    costs, cost_metrics = {}, {}
    current = None
    for line in read("generated_files/RQ13_cost_metrics.tex").splitlines():
        cells = line.split("&")
        if len(cells) != 3 or not cited_ids(line):
            continue
        if (m := re.search(r"(Time|Resource) \((\d+)\)", cells[0])):
            current = m[1]
            costs[current] = {"count": int(m[2]), "ids": set()}
        label, count = re.search(r"([^()]+)\((\d+)\)", cells[1]).groups()
        ids = cited_ids(line)
        assert len(ids) == int(count)
        costs[current]["ids"].update(ids)
        cost_metrics[current + ": " + label.strip()] = len(ids)
    assert all(len(v["ids"]) == v["count"] for v in costs.values())
    for category in ["Time", "Resource"]:
        metrics = {name.split(": ", 1)[1]: count for name, count in cost_metrics.items() if name.startswith(category + ": ")}
        chart("evaluation", category.lower() + "-cost", category + " metrics", category + " metrics",
              f"235 primary studies; {costs[category]['count']} report {category.lower()} costs",
              "Distinct studies per metric. A study may report multiple metrics.",
              "Paper: cost metrics", rows(metrics))

    baselines, _ = grouped_table("RQ14_baselines.tex")
    baseline_counts = {k: v["count"] for k, v in baselines.items()}
    assert baseline_counts == {"LLM-Based": 42, "Rule-Based": 15, "Deep Learning": 6, "Traditional ML": 3, "Hybrid": 2, "Random": 2, "Search-Based": 2}
    assert len(set().union(*(v["ids"] for v in baselines.values()))) == 58
    chart("evaluation", "baselines", "Baselines", "Baseline types used for evaluation", "235 primary studies; 58 use baseline methods",
          "Distinct studies per baseline type, deduplicated across MDE tasks. A study may compare against multiple baseline types.",
          "Paper: baseline types", rows(baseline_counts))

    materials = facet_counts(studies, "components")
    assert materials == {"Benchmark": 96, "Code": 60, "Prompt": 59, "Model": 5}
    assert sum(bool(s["facets"]["components"]) for s in studies) == 125
    assert "96 primary studies provide" in content and "125 out of" in content
    chart("evaluation", "materials", "Replication materials", "Availability of replication materials", "235 primary studies; 125 share at least one artifact",
          "Distinct studies per artifact type. A study can share several artifacts; bars do not sum to the number of studies with materials.",
          "Paper: replication-material availability", rows({"Evaluation subjects": materials["Benchmark"], "Source code": materials["Code"], "Prompts": materials["Prompt"], "Enhanced LLMs": materials["Model"]}))

    result = {"parts": charts}
    (SITE / "assets/findings-data.js").write_text("/* Generated by scripts/build_findings.py; do not edit counts by hand. */\nwindow.LLM4MDE_FINDINGS = " + json.dumps(result, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
    audit = {"manuscript": "camera-ready/camera-ready-submitted", "dataset_sha256": hashlib.sha256((SITE / "assets/data.js").read_bytes()).hexdigest(), "sources": used, "charts": sum(len(group) for group in charts.values()), "validation": "Chart counts checked against manuscript figures, table citations, and reported totals. Study sets deduplicated within each category."}
    (SITE / "downloads/findings-provenance.json").write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    print(f"Built and validated {audit['charts']} charts across {len(charts)} Findings sections.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manuscript", type=Path, required=True)
    build(parser.parse_args().manuscript)
