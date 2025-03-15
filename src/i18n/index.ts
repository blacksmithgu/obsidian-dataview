import en from './en';
import zhCN from './zh-CN';

export interface I18n {
    settings: {
        renderNullAs: string;
        renderNullAsDesc: string;
        taskCompletionTracking: string;
        taskCompletionTrackingDesc: string;
        taskCompletionTrackingExample: string;
        taskCompletionUseEmojiShorthand: string;
        taskCompletionUseEmojiShorthandDesc: string;
        taskCompletionUseEmojiShorthandExample: string;
        taskCompletionUseEmojiShorthandNote: string;
        taskCompletionText: string;
        taskCompletionTextDesc: string;
        taskCompletionDateFormat: string;
        taskCompletionDateFormatDesc: string;
        recursiveSubTaskCompletion: string;
        recursiveSubTaskCompletionDesc: string;
        warnOnEmptyResult: string;
        warnOnEmptyResultDesc: string;
        refreshEnabled: string;
        refreshEnabledDesc: string;
        refreshInterval: string;
        refreshIntervalDesc: string;
        defaultDateFormat: string;
        defaultDateFormatDesc: string;
        defaultDateTimeFormat: string;
        defaultDateTimeFormatDesc: string;
        maxRecursiveRenderDepth: string;
        allowHtml: string;
        tableIdColumnName: string;
        tableIdColumnNameDesc: string;
        tableGroupColumnName: string;
        tableGroupColumnNameDesc: string;
        showResultCount: string;
        showResultCountDesc: string;
        inlineQueryPrefix: string;
        inlineQueryPrefixDesc: string;
        inlineJsQueryPrefix: string;
        inlineJsQueryPrefixDesc: string;
        inlineQueriesInCodeblocks: string;
        inlineQueriesInCodeblocksDesc: string;
        enableDataviewJs: string;
        enableDataviewJsDesc: string;
        enableInlineDataview: string;
        enableInlineDataviewDesc: string;
        enableInlineDataviewJs: string;
        enableInlineDataviewJsDesc: string;
        prettyRenderInlineFields: string;
        prettyRenderInlineFieldsDesc: string;
        prettyRenderInlineFieldsInLivePreview: string;
        prettyRenderInlineFieldsInLivePreviewDesc: string;
        dataviewJsKeyword: string;
        dataviewJsKeywordDesc: string;
        currentFormat: string;
        onlyAvailableWhenEnabled: string;
        onlyAvailableWhenEnabledAndShorthandDisabled: string;
    };
    ui: {
        noResults: string;
        loading: string;
        error: string;
        refresh: string;
        taskComplete: string;
        taskIncomplete: string;
    };
    errors: {
        invalidQuery: string;
        invalidSyntax: string;
        dataviewDisabled: string;
        jsDisabled: string;
    };
}

const messages: { [key: string]: I18n } = {
    en,
    'zh-CN': zhCN,
};

export function getI18n(locale: string = 'en'): I18n {
    console.log('Loading locale:', locale);
    const i18n = messages[locale] || messages['en'];
    console.log('Loaded translations:', i18n);
    return i18n;
} 