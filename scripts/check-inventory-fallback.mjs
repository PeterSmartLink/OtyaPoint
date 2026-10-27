import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/dashboard.tsx", import.meta.url), "utf8");
const catchStart = source.indexOf(".catch((error: unknown) => {");
assert.notEqual(catchStart, -1, "inventory API must have an explicit error handler");
const catchEnd = source.indexOf("});", catchStart);
assert.notEqual(catchEnd, -1, "inventory API error handler must close");
const errorHandler = source.slice(catchStart, catchEnd);

assert.match(errorHandler, /setProducts\(\[\]\)/, "API failure must clear inventory rows");
assert.match(errorHandler, /setInventorySource\("unavailable"\)/, "API failure must mark inventory unavailable");
assert.doesNotMatch(errorHandler, /setProducts\(initialProducts\)/, "API failure must never substitute demo products");
assert.doesNotMatch(errorHandler, /setInventorySource\("demo"\)/, "API failure must never relabel demo products as a fallback");
assert.match(source, /sample records are intentionally hidden/, "unavailable inventory must have an explicit empty state");
assert.match(source, /target database environment still requires verification/, "API data must not be called live before environment verification");

console.log("Inventory fallback guard passed.");
