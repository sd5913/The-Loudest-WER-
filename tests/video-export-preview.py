"""Run against a local static server with Python Playwright and Chromium installed."""
import argparse

from playwright.sync_api import sync_playwright


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("studio_url", help="Local URL of studio.html")
parser.add_argument("--chromium", help="Optional Chromium executable")
args = parser.parse_args()

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=args.chromium)
    page = browser.new_page()
    page.goto(args.studio_url)
    page.locator("[data-flow=manual]:visible").first.click()
    # Delay only the detached stage background image used by snapshotStage.
    page.evaluate("""() => {
        const decode = HTMLImageElement.prototype.decode;
        window.pendingStages = [];
        HTMLImageElement.prototype.decode = function() {
            const result = decode.call(this);
            if (this.isConnected || !this.src.includes('stage-')) return result;
            return new Promise((resolve, reject) => pendingStages.push({
                finish: () => resolve(result),
                fail: () => reject(Error('simulated late decode failure'))
            }));
        };
    }""")
    create = page.locator("#startVideoExport")
    page.click("#exportVideo")
    page.wait_for_function("pendingStages.length === 1")
    assert create.is_disabled()
    page.click("#closeVideoExport")
    page.click("#exportVideo")
    page.wait_for_function("pendingStages.length === 2")
    assert create.is_disabled()
    page.evaluate("pendingStages[1].finish()")
    page.wait_for_function("!document.querySelector('#startVideoExport').disabled")
    page.evaluate("pendingStages[0].fail()")
    assert page.locator("#videoExportStatus").inner_text().startswith("Ready.")
    create.click()
    with page.expect_download(timeout=60000) as result:
        page.locator("#downloadVideo").click(timeout=60000)
    assert result.value.path().stat().st_size > 0
    browser.close()
