"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function numSlice(name: string, displayName: string, value: number, min = 0, max = 100): formattingSettings.NumUpDown {
    return new formattingSettings.NumUpDown({ name, displayName, value, options: { minValue: { type: powerbi.visuals.ValidatorType.Min, value: min }, maxValue: { type: powerbi.visuals.ValidatorType.Max, value: max } } });
}

function fontSizeSlice(name: string, displayName: string, value: number): formattingSettings.NumUpDown {
    return numSlice(name, displayName, value, 8, 40);
}

function colorSlice(name: string, displayName: string, value: string): formattingSettings.ColorPicker {
    return new formattingSettings.ColorPicker({ name, displayName, value: { value } });
}

function toggleSlice(name: string, displayName: string, value: boolean): formattingSettings.ToggleSwitch {
    return new formattingSettings.ToggleSwitch({ name, displayName, value });
}

// ─── Grid Card ───────────────────────────────────────────────────────────────

class GridCard extends FormattingSettingsCard {
    showHorizontalLines = toggleSlice("showHorizontalLines", "Horizontal gridlines", true);
    horizontalLineColor = colorSlice("horizontalLineColor", "Horizontal line color", "#edebe9");
    horizontalLineWeight = numSlice("horizontalLineWeight", "Horizontal line weight", 1, 1, 5);
    showVerticalLines = toggleSlice("showVerticalLines", "Vertical gridlines", false);
    verticalLineColor = colorSlice("verticalLineColor", "Vertical line color", "#edebe9");
    verticalLineWeight = numSlice("verticalLineWeight", "Vertical line weight", 1, 1, 5);
    rowPadding = numSlice("rowPadding", "Row padding", 3, 0, 20);
    alternatingRowBg = toggleSlice("alternatingRowBg", "Alternating row background", false);
    alternatingRowColor = colorSlice("alternatingRowColor", "Alternating row color", "#f3f2f1");

    name: string = "grid";
    displayName: string = "Grid";
    slices: Array<FormattingSettingsSlice> = [
        this.showHorizontalLines, this.horizontalLineColor, this.horizontalLineWeight,
        this.showVerticalLines, this.verticalLineColor, this.verticalLineWeight,
        this.rowPadding, this.alternatingRowBg, this.alternatingRowColor
    ];
}

// ─── Blank Rows Card ─────────────────────────────────────────────────────────

class BlankRowsCard extends FormattingSettingsCard {
    showBlankRows = toggleSlice("showBlankRows", "Show blank rows", false);

    name: string = "blankRows";
    displayName: string = "Blank rows";
    slices: Array<FormattingSettingsSlice> = [this.showBlankRows];
}

// ─── Values Card ─────────────────────────────────────────────────────────────

class ValuesCard extends FormattingSettingsCard {
    fontFamily = new formattingSettings.FontPicker({ name: "fontFamily", displayName: "Font", value: "Segoe UI" });
    fontSize = fontSizeSlice("fontSize", "Text size", 13);
    bold = toggleSlice("bold", "Bold", false);
    italic = toggleSlice("italic", "Italic", false);
    fontColor = colorSlice("fontColor", "Font color", "#252423");
    backgroundColor = colorSlice("backgroundColor", "Background color", "#ffffff");
    wordWrap = toggleSlice("wordWrap", "Word wrap", false);
    textAlignment = new formattingSettings.ItemDropdown({
        name: "textAlignment", displayName: "Text alignment",
        value: { value: "right", displayName: "Right" },
        items: [
            { value: "left", displayName: "Left" },
            { value: "center", displayName: "Center" },
            { value: "right", displayName: "Right" }
        ]
    });
    displayUnits = new formattingSettings.ItemDropdown({
        name: "displayUnits", displayName: "Display units",
        value: { value: "auto", displayName: "Auto" },
        items: [
            { value: "none", displayName: "None" },
            { value: "auto", displayName: "Auto" },
            { value: "thousands", displayName: "Thousands" },
            { value: "millions", displayName: "Millions" },
            { value: "billions", displayName: "Billions" }
        ]
    });
    decimalPlaces = numSlice("decimalPlaces", "Decimal places", 0, 0, 10);

    name: string = "values";
    displayName: string = "Values";
    slices: Array<FormattingSettingsSlice> = [
        this.fontFamily, this.fontSize, this.bold, this.italic,
        this.fontColor, this.backgroundColor, this.wordWrap,
        this.textAlignment, this.displayUnits, this.decimalPlaces
    ];
}

// ─── Column Headers Card ──────────────────────────────────────────────────────

class ColumnHeadersCard extends FormattingSettingsCard {
    fontFamily = new formattingSettings.FontPicker({ name: "fontFamily", displayName: "Font", value: "Segoe UI" });
    fontSize = fontSizeSlice("fontSize", "Text size", 13);
    bold = toggleSlice("bold", "Bold", true);
    italic = toggleSlice("italic", "Italic", false);
    fontColor = colorSlice("fontColor", "Font color", "#252423");
    backgroundColor = colorSlice("backgroundColor", "Background color", "#ffffff");
    wordWrap = toggleSlice("wordWrap", "Word wrap", false);
    textAlignment = new formattingSettings.ItemDropdown({
        name: "textAlignment", displayName: "Text alignment",
        value: { value: "right", displayName: "Right" },
        items: [
            { value: "left", displayName: "Left" },
            { value: "center", displayName: "Center" },
            { value: "right", displayName: "Right" }
        ]
    });
    autoSizeWidth = toggleSlice("autoSizeWidth", "Auto size column width", true);

    name: string = "columnHeaders";
    displayName: string = "Column headers";
    slices: Array<FormattingSettingsSlice> = [
        this.fontFamily, this.fontSize, this.bold, this.italic,
        this.fontColor, this.backgroundColor, this.wordWrap,
        this.textAlignment, this.autoSizeWidth
    ];
}

// ─── Row Headers Card ─────────────────────────────────────────────────────────

class RowHeadersCard extends FormattingSettingsCard {
    fontFamily = new formattingSettings.FontPicker({ name: "fontFamily", displayName: "Font", value: "Segoe UI" });
    fontSize = fontSizeSlice("fontSize", "Text size", 13);
    bold = toggleSlice("bold", "Bold", false);
    italic = toggleSlice("italic", "Italic", false);
    fontColor = colorSlice("fontColor", "Font color", "#252423");
    backgroundColor = colorSlice("backgroundColor", "Background color", "#ffffff");
    wordWrap = toggleSlice("wordWrap", "Word wrap", false);
    steppedLayout = toggleSlice("steppedLayout", "Stepped layout", true);
    steppedLayoutIndent = numSlice("steppedLayoutIndent", "Stepped layout indent", 15, 0, 40);
    expandCollapseIconColor = colorSlice("expandCollapseIconColor", "Expand/collapse icon color", "#323130");

    name: string = "rowHeaders";
    displayName: string = "Row headers";
    slices: Array<FormattingSettingsSlice> = [
        this.fontFamily, this.fontSize, this.bold, this.italic,
        this.fontColor, this.backgroundColor, this.wordWrap,
        this.steppedLayout, this.steppedLayoutIndent, this.expandCollapseIconColor
    ];
}

// ─── Column Subtotals Card ───────────────────────────────────────────────────

class ColumnSubtotalsCard extends FormattingSettingsCard {
    show = toggleSlice("show", "On", true);
    position = new formattingSettings.ItemDropdown({
        name: "position", displayName: "Position",
        value: { value: "bottom", displayName: "Bottom" },
        items: [
            { value: "top", displayName: "Top" },
            { value: "bottom", displayName: "Bottom" }
        ]
    });
    fontFamily = new formattingSettings.FontPicker({ name: "fontFamily", displayName: "Font", value: "Segoe UI" });
    fontSize = fontSizeSlice("fontSize", "Text size", 13);
    bold = toggleSlice("bold", "Bold", true);
    fontColor = colorSlice("fontColor", "Font color", "#252423");
    backgroundColor = colorSlice("backgroundColor", "Background color", "#f3f2f1");
    label = new formattingSettings.TextInput({ name: "label", displayName: "Label", value: "Total", placeholder: "Enter label" });

    name: string = "columnSubtotals";
    displayName: string = "Column subtotals";
    slices: Array<FormattingSettingsSlice> = [
        this.show, this.position, this.fontFamily, this.fontSize,
        this.bold, this.fontColor, this.backgroundColor, this.label
    ];
}

// ─── Row Subtotals Card ──────────────────────────────────────────────────────

class RowSubtotalsCard extends FormattingSettingsCard {
    show = toggleSlice("show", "On", true);
    position = new formattingSettings.ItemDropdown({
        name: "position", displayName: "Position",
        value: { value: "bottom", displayName: "Bottom" },
        items: [
            { value: "top", displayName: "Top" },
            { value: "bottom", displayName: "Bottom" }
        ]
    });
    fontFamily = new formattingSettings.FontPicker({ name: "fontFamily", displayName: "Font", value: "Segoe UI" });
    fontSize = fontSizeSlice("fontSize", "Text size", 13);
    bold = toggleSlice("bold", "Bold", true);
    fontColor = colorSlice("fontColor", "Font color", "#252423");
    backgroundColor = colorSlice("backgroundColor", "Background color", "#f3f2f1");
    label = new formattingSettings.TextInput({ name: "label", displayName: "Label", value: "Total", placeholder: "Enter label" });

    name: string = "rowSubtotals";
    displayName: string = "Row subtotals";
    slices: Array<FormattingSettingsSlice> = [
        this.show, this.position, this.fontFamily, this.fontSize,
        this.bold, this.fontColor, this.backgroundColor, this.label
    ];
}

// ─── Column Grand Total Card ─────────────────────────────────────────────────

class ColumnGrandTotalCard extends FormattingSettingsCard {
    show = toggleSlice("show", "On", true);
    fontFamily = new formattingSettings.FontPicker({ name: "fontFamily", displayName: "Font", value: "Segoe UI" });
    fontSize = fontSizeSlice("fontSize", "Text size", 13);
    bold = toggleSlice("bold", "Bold", true);
    fontColor = colorSlice("fontColor", "Font color", "#252423");
    backgroundColor = colorSlice("backgroundColor", "Background color", "#f3f2f1");
    label = new formattingSettings.TextInput({ name: "label", displayName: "Label", value: "Total", placeholder: "Enter label" });

    name: string = "columnGrandTotal";
    displayName: string = "Column grand total";
    slices: Array<FormattingSettingsSlice> = [
        this.show, this.fontFamily, this.fontSize,
        this.bold, this.fontColor, this.backgroundColor, this.label
    ];
}

// ─── Row Grand Total Card ────────────────────────────────────────────────────

class RowGrandTotalCard extends FormattingSettingsCard {
    show = toggleSlice("show", "On", true);
    fontFamily = new formattingSettings.FontPicker({ name: "fontFamily", displayName: "Font", value: "Segoe UI" });
    fontSize = fontSizeSlice("fontSize", "Text size", 13);
    bold = toggleSlice("bold", "Bold", true);
    fontColor = colorSlice("fontColor", "Font color", "#252423");
    backgroundColor = colorSlice("backgroundColor", "Background color", "#f3f2f1");
    label = new formattingSettings.TextInput({ name: "label", displayName: "Label", value: "Total", placeholder: "Enter label" });

    name: string = "rowGrandTotal";
    displayName: string = "Row grand total";
    slices: Array<FormattingSettingsSlice> = [
        this.show, this.fontFamily, this.fontSize,
        this.bold, this.fontColor, this.backgroundColor, this.label
    ];
}

// ─── Cell Elements Card ──────────────────────────────────────────────────────

class CellElementsCard extends FormattingSettingsCard {
    showDataBars = toggleSlice("showDataBars", "Data bars", false);
    positiveBarColor = colorSlice("positiveBarColor", "Positive bar color", "#2d7dd2");
    negativeBarColor = colorSlice("negativeBarColor", "Negative bar color", "#e63946");
    showBarAxis = toggleSlice("showBarAxis", "Show axis", true);
    barAxisColor = colorSlice("barAxisColor", "Axis color", "#8a8886");

    name: string = "cellElements";
    displayName: string = "Cell elements";
    slices: Array<FormattingSettingsSlice> = [
        this.showDataBars, this.positiveBarColor, this.negativeBarColor,
        this.showBarAxis, this.barAxisColor
    ];
}

// ─── Function Button Card ───────────────────────────────────────────────────

class FunctionButtonCard extends FormattingSettingsCard {
    show            = toggleSlice("show", "Show button", true);
    valueLabel      = new formattingSettings.TextInput({ name: "valueLabel",    displayName: "Label (values mode)",   value: "Values",         placeholder: "e.g. Values" });
    functionLabel   = new formattingSettings.TextInput({ name: "functionLabel", displayName: "Label (function mode)", value: "Function Value", placeholder: "e.g. Market Share" });
    fontSize        = fontSizeSlice("fontSize", "Text size", 11);
    fontColor       = colorSlice("fontColor",       "Font color",       "#ffffff");
    backgroundColor = colorSlice("backgroundColor", "Background color", "#2b5797");
    borderColor     = colorSlice("borderColor",     "Border color",     "#1e3f7a");

    name: string = "functionButton";
    displayName: string = "Function Button";
    slices: Array<FormattingSettingsSlice> = [
        this.show, this.valueLabel, this.functionLabel,
        this.fontSize, this.fontColor, this.backgroundColor, this.borderColor
    ];
}

// ─── Specific Column Card ────────────────────────────────────────────────────

class SpecificColumnCard extends FormattingSettingsCard {
    applyToColumnIndex = numSlice("applyToColumnIndex", "Apply to column (index)", 0, 0, 50);
    fontColor = colorSlice("fontColor", "Font color", "");
    backgroundColor = colorSlice("backgroundColor", "Background color", "");
    textAlignment = new formattingSettings.ItemDropdown({
        name: "textAlignment", displayName: "Text alignment",
        value: { value: "default", displayName: "Default" },
        items: [
            { value: "default", displayName: "Default" },
            { value: "left", displayName: "Left" },
            { value: "center", displayName: "Center" },
            { value: "right", displayName: "Right" }
        ]
    });

    name: string = "specificColumn";
    displayName: string = "Specific column";
    slices: Array<FormattingSettingsSlice> = [
        this.applyToColumnIndex, this.fontColor, this.backgroundColor, this.textAlignment
    ];
}

// ─── Layout and Style Presets Card ──────────────────────────────────────────

class LayoutPresetsCard extends FormattingSettingsCard {
    style = new formattingSettings.ItemDropdown({
        name: "style", displayName: "Style",
        value: { value: "default", displayName: "Default" },
        items: [
            { value: "default", displayName: "Default" },
            { value: "minimal", displayName: "Minimal" },
            { value: "boldHeader", displayName: "Bold header" },
            { value: "alternating", displayName: "Alternating rows" },
            { value: "contrast", displayName: "Contrast" }
        ]
    });

    name: string = "layoutPresets";
    displayName: string = "Layout and style presets";
    slices: Array<FormattingSettingsSlice> = [this.style];
}

// ─── Model ───────────────────────────────────────────────────────────────────

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    layoutPresets = new LayoutPresetsCard();
    grid = new GridCard();
    blankRows = new BlankRowsCard();
    values = new ValuesCard();
    columnHeaders = new ColumnHeadersCard();
    rowHeaders = new RowHeadersCard();
    columnSubtotals = new ColumnSubtotalsCard();
    rowSubtotals = new RowSubtotalsCard();
    columnGrandTotal = new ColumnGrandTotalCard();
    rowGrandTotal = new RowGrandTotalCard();
    cellElements = new CellElementsCard();
    functionButton  = new FunctionButtonCard();
    specificColumn  = new SpecificColumnCard();

    cards = [
        this.layoutPresets,
        this.grid,
        this.blankRows,
        this.values,
        this.columnHeaders,
        this.rowHeaders,
        this.columnSubtotals,
        this.rowSubtotals,
        this.columnGrandTotal,
        this.rowGrandTotal,
        this.cellElements,
        this.functionButton,
        this.specificColumn
    ];
}
