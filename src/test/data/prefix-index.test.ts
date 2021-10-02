import { PrefixIndexNode, PrefixIndex } from "data/index";
import { Vault } from "obsidian";

test("Emoji Folder (Node)", () => {
    let pi = new PrefixIndexNode("<root>");
    PrefixIndexNode.add(pi, "dataview/⚗️ KNOWLEDGE/Test.md");

    let child = PrefixIndexNode.find(pi, "dataview/⚗️ KNOWLEDGE");
    expect(child).toBeTruthy();
    expect(child?.element).toEqual("⚗️ KNOWLEDGE");
});

test("Emoji Folder (Index)", () => {
    let pi = new PrefixIndexNode("<root>");
    PrefixIndexNode.add(pi, "dataview/⚗️ KNOWLEDGE/Test.md");

    let index = new PrefixIndex(new Vault(), pi, () => {});

    expect(index.get("dataview/⚗️ KNOWLEDGE")).toEqual(new Set(["dataview/⚗️ KNOWLEDGE/Test.md"]));
});
