import fs from "node:fs";

const generated = JSON.parse(fs.readFileSync(new URL("./generated/upstream.json", import.meta.url), "utf8"));

export default generated.cases;
