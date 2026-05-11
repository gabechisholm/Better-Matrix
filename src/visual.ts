import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import { MatrixApp } from "./components/MatrixApp";
import { MatrixRowNode, MatrixColNode, MatrixHeaderNode, parseMatrix } from "./parser";
import { VisualFormattingSettingsModel } from "./settings";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;

export class Visual implements IVisual {
    private target: HTMLElement;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private reactRoot: HTMLElement;
    private root: Root;

    // Cache the last successfully parsed matrix data so that formatting-only
    // updates (which Power BI fires without refreshing the matrix in dataViews)
    // still re-render with live data instead of falling to the empty state.
    private cachedRows: MatrixRowNode[] = [];
    private cachedColumns: MatrixColNode[] = [];
    private cachedHeaderTree: MatrixHeaderNode[] = [];
    private cachedFunctionValueColIndices: Set<number> = new Set();
    private hasData = false;

    constructor(options: VisualConstructorOptions) {
        this.formattingSettingsService = new FormattingSettingsService();
        this.formattingSettings = new VisualFormattingSettingsModel();
        this.target = options.element;
        this.target.style.overflow = "hidden";

        this.reactRoot = document.createElement("div");
        this.reactRoot.style.height = "100%";
        this.reactRoot.style.width = "100%";
        this.target.appendChild(this.reactRoot);
        this.root = createRoot(this.reactRoot);
    }

    public update(options: VisualUpdateOptions) {
        // Always re-populate settings when a dataView is present (covers both
        // data updates and formatting-pane changes that include a dataView).
        if (options.dataViews && options.dataViews.length > 0 && options.dataViews[0]) {
            this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
                VisualFormattingSettingsModel,
                options.dataViews[0]
            );

            // Only refresh the cached matrix data when the matrix is actually present.
            if (options.dataViews[0].matrix) {
                const { rows, columns, headerTree, functionValueColIndices } = parseMatrix(options.dataViews[0]);
                this.cachedRows = rows;
                this.cachedColumns = columns;
                this.cachedHeaderTree = headerTree;
                this.cachedFunctionValueColIndices = functionValueColIndices;
                this.hasData = true;
            }
        }

        if (this.hasData) {
            // Re-render with (possibly cached) data and the latest settings.
            // Spreading ensures React sees a new settings reference every time.
            this.root.render(
                React.createElement(MatrixApp, {
                    rows: this.cachedRows,
                    columns: this.cachedColumns,
                    headerTree: this.cachedHeaderTree,
                    settings: this.formattingSettings,
                    functionValueColIndices: this.cachedFunctionValueColIndices,
                    renderKey: Date.now()
                })
            );
        } else {
            this.root.render(
                React.createElement("div", {
                    style: {
                        padding: "16px",
                        fontFamily: "Segoe UI, sans-serif",
                        fontSize: "13px",
                        color: "#605e5c"
                    }
                }, "Add fields to Rows, Columns, and Values to display the matrix.")
            );
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}
