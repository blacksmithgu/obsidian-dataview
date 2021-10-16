import { PrefixIndexNode } from "data/index";

test("Emoji Folder (Node)", () => {
    let pi = new PrefixIndexNode("<root>");
    PrefixIndexNode.add(pi, "dataview/⚗️ KNOWLEDGE/Test.md");

    let child = PrefixIndexNode.find(pi, "dataview/⚗️ KNOWLEDGE");
    expect(child).toBeTruthy();
    expect(child?.element).toEqual("⚗️ KNOWLEDGE");
});
