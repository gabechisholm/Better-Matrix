import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import { MatrixApp } from "./components/MatrixApp";
import { parseMatrix } from "./parser";
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

    constructor(options: VisualConstructorOptions) {
        this.formattingSettingsService = new FormattingSettingsService();
        this.target = options.element;
        this.target.style.overflow = "hidden";

        this.reactRoot = document.createElement("div");
        this.reactRoot.style.height = "100%";
        this.reactRoot.style.width = "100%";
        this.target.appendChild(this.reactRoot);
        this.root = createRoot(this.reactRoot);
    }

    public update(options: VisualUpdateOptions) {
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
            VisualFormattingSettingsModel,
            options.dataViews[0]
        );

        if (options.dataViews && options.dataViews.length > 0 && options.dataViews[0].matrix) {
            const { rows, columns, headerTree } = parseMatrix(options.dataViews[0]);

            this.root.render(
                React.createElement(MatrixApp, {
                    rows,
                    columns,
                    headerTree,
                    settings: this.formattingSettings
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