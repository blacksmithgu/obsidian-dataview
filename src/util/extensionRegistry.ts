import type { InlineField } from "data-import/inline-field";

interface CustomSpecialTaskFieldExtractor {
    name: string;
    exec: (line: string) => InlineField;
}
class ExtensionRegistry {
    _customSpecialTaskFieldExtractors: Array<CustomSpecialTaskFieldExtractor> = [];

    addCustomSpecialTaskFieldExtractor(customExtractor: CustomSpecialTaskFieldExtractor) {
        this._customSpecialTaskFieldExtractors.push(customExtractor);
    }
}

export const extensionRegistry = new ExtensionRegistry();
