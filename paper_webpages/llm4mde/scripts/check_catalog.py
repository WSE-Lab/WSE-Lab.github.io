"""Browser regression checks for the overview and catalog interactions.

Run with Python + websocket-client and Microsoft Edge on Windows.
Uses a temporary headless browser profile; no preview server is started.
"""
import base64
import json
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.request

import websocket

SITE = Path(__file__).resolve().parents[1]
PROFILE = Path(tempfile.mkdtemp(prefix="llm4mde-query-check-"))
EDGE = Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")


def main():
    browser = subprocess.Popen([str(EDGE), "--headless=new", "--disable-gpu", "--no-first-run",
                                "--remote-debugging-port=0", "--user-data-dir=" + str(PROFILE), "about:blank"],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                               creationflags=subprocess.CREATE_NO_WINDOW)
    connection = None
    try:
        for _ in range(150):
            try:
                port = (PROFILE / "DevToolsActivePort").read_text().splitlines()[0]
                pages = json.load(urllib.request.urlopen("http://localhost:" + port + "/json"))
                break
            except (OSError, IndexError):
                time.sleep(.1)
        connection = websocket.create_connection(next(page["webSocketDebuggerUrl"] for page in pages if page["type"] == "page"),
                                                 suppress_origin=True, timeout=20)
        sequence = 0

        def call(method, params=None):
            nonlocal sequence
            sequence += 1
            connection.send(json.dumps({"id": sequence, "method": method, "params": params or {}}))
            while True:
                message = json.loads(connection.recv())
                if message.get("id") == sequence:
                    assert "error" not in message, message
                    return message.get("result", {})

        def js(code):
            result = call("Runtime.evaluate", {"expression": code, "returnByValue": True})
            assert "exceptionDetails" not in result, result
            return result["result"].get("value")

        def act(code):
            return js("(()=>{" + code + "})()")

        def click(selector):
            act("const node=document.querySelector(" + json.dumps(selector) + ");if(!node)throw Error('Missing control');node.click();")

        def select(selector, value):
            act("const node=document.querySelector(" + json.dumps(selector) + ");node.value=" + json.dumps(value) + ";node.dispatchEvent(new Event('change',{bubbles:true}));")

        def enter(selector, value):
            act("const node=document.querySelector(" + json.dumps(selector) + ");node.value=" + json.dumps(value) + ";node.dispatchEvent(new Event('input',{bubbles:true}));")

        def filter_selector(field):
            return '.query-filter[data-field="' + field + '"]'

        def add_filter(field):
            click('.filter-field-choice[data-field="' + field + '"]')

        def choose(field, value):
            selector = filter_selector(field) + ' input[type="checkbox"]'
            act("const node=[...document.querySelectorAll(" + json.dumps(selector) + ")].find(x=>x.value===" + json.dumps(value) + ");if(!node||node.disabled)throw Error('Unavailable value');node.click();")

        def count():
            assert js("[...document.querySelectorAll('.filter-value-list')].every(list=>{const counts=[...list.querySelectorAll('.filter-option-count')].map(x=>Number(x.textContent));return counts.every((count,i)=>i===0||counts[i-1]>=count)})"), "Filter options must be sorted by current count"
            return js("Number(document.getElementById('result-count').textContent.split(' ')[0])")

        def columns():
            return js("[...document.querySelectorAll('.study-table th')].map(x=>x.dataset.field)")

        def load(query=""):
            call("Page.navigate", {"url": (SITE / "catalog.html").as_uri() + query})
            for _ in range(150):
                if js("document.querySelectorAll('.filter-field-choice').length") == 37:
                    break
                time.sleep(.1)
            assert js("window.checkErrors") == [], js("window.checkErrors")

        call("Page.enable")
        call("Page.addScriptToEvaluateOnNewDocument", {"source": "window.checkErrors=[];addEventListener('error',e=>checkErrors.push(e.message))"})
        call("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 1100, "deviceScaleFactor": 1, "mobile": False})
        call("Page.navigate", {"url": (SITE / "index.html").as_uri()})
        for _ in range(150):
            if js("document.querySelectorAll('.analysis-card').length") == 27:
                break
            time.sleep(.1)
        assert js("window.checkErrors") == [], js("window.checkErrors")
        assert js("document.querySelectorAll('#abstract-text p').length") == 1
        assert js("document.getElementById('abstract-text').textContent===LLM4MDE_DATA.abstract")
        assert js("getComputedStyle(document.querySelector('.abstract-meta em')).fontStyle") == "italic"
        assert js("[...document.querySelectorAll('.finding-part-number')].map(x=>x.textContent).join(',')") == "01,02,03,04"
        assert js("(()=>{const ids=[...document.querySelectorAll('[id]')].map(x=>x.id);return new Set(ids).size===ids.length})()")
        assert js("!document.querySelector('.analysis-source,.analysis-data')")
        # Every chart row must still show the generated count, including hidden rows.
        act("for(const [part,charts] of Object.entries(LLM4MDE_FINDINGS.parts)){for(const chart of charts){const card=document.getElementById('finding-'+part+'-'+chart.id).querySelector('.analysis-card');const rows=card.querySelectorAll(':scope > .analysis-bars > .analysis-row');if(rows.length!==chart.rows.length)throw Error(chart.id+' row count');rows.forEach((row,i)=>{const values=[...row.querySelectorAll(':scope > .analysis-values strong')].map(x=>Number(x.textContent));if(JSON.stringify(values)!==JSON.stringify(chart.rows[i].values))throw Error(chart.id+' values')});}}")
        for width in [1440, 768, 390, 320]:
            call("Emulation.setDeviceMetricsOverride", {"width": width, "height": 1100, "deviceScaleFactor": 1, "mobile": False})
            act("for(const tab of document.querySelectorAll('[data-tab]')){tab.click();if(document.documentElement.scrollWidth>innerWidth)throw Error('Taxonomy overflow '+tab.id)}")
            act("for(const article of document.querySelectorAll('.finding-part')){for(const tab of article.querySelector(':scope > .finding-tabs').children){tab.click();const panel=document.getElementById(tab.getAttribute('aria-controls'));if(document.documentElement.scrollWidth>innerWidth)throw Error('Findings overflow '+tab.id);for(const sub of panel.querySelectorAll('.finding-subtabs button')){sub.click();if(document.documentElement.scrollWidth>innerWidth)throw Error('Subtab overflow '+sub.id)}}}")
        click("#finding-scope-models-tab")
        act("document.querySelectorAll('#finding-scope-models .analysis-type-toggle').forEach(button=>button.click())")
        assert js("document.querySelectorAll('#finding-scope-models .analysis-types:not([hidden]) > li').length") == 43
        assert js("document.documentElement.scrollWidth<=innerWidth")
        click("#finding-scope-models .analysis-actions button")
        assert js("document.getElementById('chart-dialog').open")
        click("#chart-dialog .dialog-close")
        time.sleep(.1)
        assert js("document.activeElement.closest('#finding-scope-models')!==null")
        click("#finding-technical-llms-tab")
        assert js("document.querySelectorAll('#finding-technical-llms .analysis-bars > li:not([hidden])').length") == 10
        click("#finding-technical-llms .analysis-more")
        assert js("document.querySelectorAll('#finding-technical-llms .analysis-bars > li:not([hidden])').length") == 31
        assert js("[...document.querySelectorAll('#finding-scope-languages .analysis-language-label')].every(label=>label.title)")
        click(".mobile-menu-btn")
        assert js("document.querySelector('.mobile-menu-btn').getAttribute('aria-expanded')") == "true"
        call("Input.dispatchKeyEvent", {"type":"keyDown", "key":"Escape", "code":"Escape", "windowsVirtualKeyCode":27})
        assert js("document.querySelector('.mobile-menu-btn').getAttribute('aria-expanded')") == "false"
        click("[data-enlarge]")
        assert js("document.getElementById('image-dialog').open")
        click("#image-dialog .dialog-close")
        act("document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,0)")
        time.sleep(.2)
        (PROFILE / "home-mobile.png").write_bytes(base64.b64decode(call("Page.captureScreenshot", {"format":"png"})["data"]))
        call("Emulation.setDeviceMetricsOverride", {"width":1440, "height":1100, "deviceScaleFactor":1, "mobile":False})
        act("window.scrollTo(0,document.getElementById('overview').getBoundingClientRect().top+scrollY-140)")
        time.sleep(.2)
        (PROFILE / "overview.png").write_bytes(base64.b64decode(call("Page.captureScreenshot", {"format":"png"})["data"]))
        assert js("window.checkErrors") == [], js("window.checkErrors")
        print("PASS: overview wording, all taxonomy/Findings tabs, 27 chart counts, 43 model types, modals and 320–1440px layouts")
        load()
        assert count() == 235 and len(columns()) == 30
        assert "BibTex" not in columns()
        assert not js("document.querySelector('[value=\"field:BibTex\"],[data-field=\"BibTex\"]')")
        assert js("getComputedStyle(document.querySelector('.catalog-stat:last-child strong')).color===getComputedStyle(document.querySelector('.catalog-stat:first-child strong')).color")
        stats_query = js("new URL(document.querySelector('.catalog-stat:last-child').href).search")
        load(stats_query)
        assert count() == 19
        assert js("document.querySelectorAll('.filter-selected .filter-tag').length") == 2
        load()
        assert not js("[...document.querySelectorAll('.filter-field-choice')].some(x=>x.textContent.includes('mapping')||x.textContent==='Available replication materials')")
        assert not js("[...document.querySelectorAll('.study-table [title]')].some(x=>x.title.startsWith('RQ'))")
        # The main use case: two contribution types form a union, not an intersection.
        add_filter("RQ3 PaperType")
        choose("RQ3 PaperType", "New idea or vision")
        choose("RQ3 PaperType", "Tool demo")
        assert count() == 19
        select("#column-preset", "basic")
        assert columns() == ["ID", "RQ1 Year", "Title"] and count() == 19
        select("#search-scope", "field:Title")
        enter("#search-input", "model")
        time.sleep(.25)
        expected = js("LLM4MDE_DATA.studies.filter(s=>['New idea or vision','Tool demo'].includes(s.paperType)&&s.title.toLowerCase().includes('model')).length")
        assert count() == expected and len(columns()) == 3
        saved = js("location.search")
        load(saved)
        assert count() == expected and len(columns()) == 3
        assert js("document.querySelectorAll('.filter-selected .filter-tag').length") == 2
        print("PASS: paper-type union, column customization, URL round trip")

        click("#reset-filters")
        add_filter("RQ6 ModelingLanguage")
        choose("RQ6 ModelingLanguage", "UML")
        choose("RQ6 ModelingLanguage", "DSL")
        assert count() == js("LLM4MDE_DATA.studies.filter(s=>s.facets.languages.some(v=>['UML','DSL'].includes(v))).length")
        select(filter_selector("RQ6 ModelingLanguage") + ' select[aria-label$="matching mode"]', "all")
        assert count() == js("LLM4MDE_DATA.studies.filter(s=>['UML','DSL'].every(v=>s.facets.languages.includes(v))).length")
        click("#clear-filters")
        add_filter("RQ1 Year")
        select(filter_selector("RQ1 Year") + " select", "range")
        enter('input[aria-label="From year"]', "2023")
        enter('input[aria-label="To year"]', "2024")
        assert count() == 110
        add_filter("RQ3 PaperType")
        choose("RQ3 PaperType", "Proposed method")
        assert count() == js("LLM4MDE_DATA.studies.filter(s=>s.year>=2023&&s.year<=2024&&s.paperType==='Proposed method').length")
        print("PASS: Match any/all and year-range intersection")

        click("#reset-filters")
        add_filter("Title")
        text_selector = filter_selector("Title") + ' input[type="text"]'
        for term in ["model", "process"]:
            enter(text_selector, term)
            click(filter_selector("Title") + ".query-filter .filter-text-input button")
        assert count() == js("LLM4MDE_DATA.studies.filter(s=>['model','process'].some(v=>s.title.toLowerCase().includes(v))).length")
        select(filter_selector("Title") + ' select[aria-label$="condition"]', "not_contains")
        assert count() == js("LLM4MDE_DATA.studies.filter(s=>['model','process'].every(v=>!s.title.toLowerCase().includes(v))).length")
        click("#clear-filters")
        add_filter("ID")
        select(filter_selector("ID") + " select", "equals")
        enter(filter_selector("ID") + ' input[type="text"]', "3")
        click(filter_selector("ID") + " .filter-text-input button")
        assert count() == 1
        click("#clear-filters")
        add_filter("RQ16 SourceCodeLink")
        has_link = count()
        assert has_link > 0
        select(filter_selector("RQ16 SourceCodeLink") + " select", "missing")
        assert count() + has_link == 235
        print("PASS: text conditions, exact matching, link presence/absence")

        click("#reset-filters")
        add_filter("@metric-scope")
        choose("@metric-scope", "Syntactic")
        assert count() == 41
        add_filter("RQ14 EffectivenessMetric")
        choose("RQ14 EffectivenessMetric", "Accuracy")
        assert count() == js("LLM4MDE_DATA.studies.filter(s=>s.raw['RQ14 EffectivenessMetric'].includes('[Syn;')&&s.raw['RQ14 EffectivenessMetric'].includes('Accuracy[')).length")
        select("#column-preset", "group:evaluation")
        assert "RQ14 EffectivenessMetric" in columns()
        assert js("document.querySelectorAll('.catalog-metric-card').length") > 0
        click(".study-title")
        assert js("document.getElementById('study-dialog').open")
        assert not js("document.querySelector('#study-detail .bibtex-block,#study-detail .detail-bib-actions')")
        assert not js("document.getElementById('study-detail').textContent.includes('Copy BibTeX')")
        assert not js("[...document.querySelectorAll('#study-detail dt')].some(x=>x.textContent.includes('mapping'))")
        click("#study-dialog .dialog-close")
        click("#cards-view-button")
        assert js("document.querySelectorAll('.study-card').length") > 0
        assert not js("document.querySelector('.study-card .chips')")
        click(".study-card .button")
        assert not js("document.getElementById('study-detail').textContent.includes('Model categories:')")
        assert not js("document.getElementById('study-detail').textContent.includes('Copy study link')")
        click("#study-dialog .dialog-close")
        click("#table-view-button")
        print("PASS: metric dimension filters and existing metric/detail views")

        load("?q=Macr%C3%AC")
        assert count() == 1
        click(".study-title")
        assert js("document.querySelector('.authors-text').textContent.includes('Macrì')")
        assert js("LLM4MDE_DATA.studies.find(s=>s.id===193).authors.includes(String.fromCharCode(92))")
        click("#study-dialog .dialog-close")
        load("?venue=International+Conference+on+Smart+Medical%2C+IoT+%26amp%3B+Artificial+Intelligence")
        assert count() == 1
        assert not js("document.querySelector('.study-table').textContent.includes('&amp;')")
        print("PASS: decoded author names, venue labels and legacy venue links")

        load("?seTask=Requirement+Specification&paperType=Proposed+method&group=scope")
        assert count() == 23
        assert "RQ4 SETask" in columns()
        assert js("document.querySelectorAll('.query-filter').length") == 2
        load("?scope=title&q=process")
        assert columns() == ["ID", "RQ1 Year", "Title"]
        load("?filters=%7Bbad&columns=%7Bbad")
        assert count() == 235
        load("?domain=Business+and+Enterprise+Systems")
        assert count() == 0 and js("document.querySelectorAll('.query-filter').length") == 1
        load()
        add_filter("RQ8 LLMAccessMode")
        choose("RQ8 LLMAccessMode", "Unspecified")
        assert count() == js("LLM4MDE_DATA.studies.filter(s=>s.facets.access.includes('Unspecified')).length")
        before = count()
        select("#column-preset", "basic")
        click('#column-options input[value="RQ8 LLMAccessMode"]')
        assert len(columns()) == 4 and count() == before
        select("#search-scope", "field:Title")
        assert len(columns()) == 3 and count() == before
        select("#search-scope", "field:RQ1 Year")
        assert columns() == ["ID", "RQ1 Year", "Title"] and count() == before
        select("#search-scope", "field:RQ8 FoundationLLMFamiliy")
        assert columns() == ["ID", "RQ1 Year", "Title", "RQ8 FoundationLLMFamiliy"] and count() == before
        select("#search-scope", "group:scope")
        assert "RQ4 SETask" in columns() and "RQ8 FoundationLLMFamiliy" not in columns() and count() == before
        select("#search-scope", "all")
        assert len(columns()) == 30 and count() == before
        click("#columns-summary")
        assert js("!document.getElementById('columns-picker').hidden && document.getElementById('columns-summary').getAttribute('aria-expanded')==='true'")
        click("#columns-summary")
        assert js("document.getElementById('columns-picker').hidden")
        click("#reset-filters")
        print("PASS: legacy URLs and malformed optional parameters")

        add_filter("RQ3 PaperType")
        choose("RQ3 PaperType", "New idea or vision")
        choose("RQ3 PaperType", "Tool demo")
        select("#column-preset", "basic")
        for width in [1440, 768, 390]:
            call("Emulation.setDeviceMetricsOverride", {"width": width, "height": 1100, "deviceScaleFactor": 1, "mobile": False})
            for picker in ["filter-picker", "columns-picker"]:
                act("document.getElementById(" + json.dumps(picker) + ")." + ("hidden=false" if picker == "columns-picker" else "open=true") + ";")
                assert js("document.documentElement.scrollWidth<=innerWidth"), (width, picker)
                act("document.getElementById(" + json.dumps(picker) + ")." + ("hidden=true" if picker == "columns-picker" else "open=false") + ";")
        call("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 1100, "deviceScaleFactor": 1, "mobile": False})
        act("document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,document.querySelector('.catalog-toolbar').getBoundingClientRect().top+scrollY-140)")
        time.sleep(.2)
        (PROFILE / "filters.png").write_bytes(base64.b64decode(call("Page.captureScreenshot", {"format":"png"})["data"]))
        assert js("window.checkErrors") == [], js("window.checkErrors")
        print("PASS: responsive pickers, no script errors")
        print("Screenshot:", PROFILE / "filters.png")
    finally:
        if connection:
            connection.close()
        browser.terminate()
        try:
            browser.wait(timeout=8)
        except subprocess.TimeoutExpired:
            browser.kill()


if __name__ == "__main__":
    main()
