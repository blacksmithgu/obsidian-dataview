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
    const vault = new Vault();
    let index = new PrefixIndex(vault, () => {});

    index.initialize();

    vault.trigger("create", { path: "dataview/⚗️ KNOWLEDGE/Test.md" });

    expect(index.get("dataview/⚗️ KNOWLEDGE")).toEqual(new Set(["dataview/⚗️ KNOWLEDGE/Test.md"]));
});
