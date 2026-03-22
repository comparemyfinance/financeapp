import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("Index.html", "utf8");

test("Index.html: application tab uses chooser + launcher fallback instead of external iframe embed", () => {
  assert.match(
    html,
    /id="application-hub-launch-view"/,
    "expected launcher panel for external application forms",
  );
  assert.match(
    html,
    /id="application-launch-link"/,
    "expected explicit launcher link element",
  );
  assert.match(
    html,
    /id="application-launch-link"[\s\S]{0,220}target="_blank"|target="_blank"[\s\S]{0,220}id="application-launch-link"/,
    "expected launcher link to open in a new tab",
  );
  assert.match(
    html,
    /id="application-launch-link"[\s\S]{0,220}rel="noopener noreferrer"|rel="noopener noreferrer"[\s\S]{0,220}id="application-launch-link"/,
    "expected launcher link to protect opener access",
  );
  assert.match(
    html,
    /window\.syncApplicationHubLaunchState = syncApplicationHubLaunchState;/,
    "expected shared launcher state helper",
  );
  assert.match(
    html,
    /window\.selectApplicationHubForm \? window\.selectApplicationHubForm\(this\) : false;/,
    "expected chooser cards to pass the selected button element into launcher state",
  );
  assert.match(
    html,
    /opens in a new tab\/window/i,
    "expected user-facing copy about new-tab fallback",
  );
  assert.doesNotMatch(
    html,
    /id="application-hub-iframe"/,
    "expected blocked external iframe container to be removed",
  );
});
