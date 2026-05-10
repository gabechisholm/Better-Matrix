import { VisualFormattingSettingsModel } from "./settings";

export type DisplayUnits = "none" | "auto" | "thousands" | "millions" | "billions";

// ── Number formatting ────────────────────────────────────────────────────────

const UNIT_MAP: Record<DisplayUnits, { divisor: number; suffix: string }> = {
    none: { divisor: 1, suffix: "" },
    auto: { divisor: 1, suffix: "" },
    thousands: { divisor: 1e3, suffix: "K" },
    millions: { divisor: 1e6, suffix: "M" },
    billions: { divisor: 1e9, suffix: "B" }
};

export function formatValue(
    raw: any,
    displayUnits: string,
    decimalPlaces: number
): string {
    if (raw === null || raw === undefined || raw === "") return "";
    const num = Number(raw);
    if (isNaN(num)) return String(raw);

    const unit = displayUnits as DisplayUnits;

    let divisor = 1;
    let suffix = "";

    if (unit === "auto") {
        const abs = Math.abs(num);
        if (abs >= 1e9) { divisor = 1e9; suffix = "B"; }
        else if (abs >= 1e6) { divisor = 1e6; suffix = "M"; }
        else if (abs >= 1e3) { divisor = 1e3; suffix = "K"; }
    } else if (UNIT_MAP[unit]) {
        divisor = UNIT_MAP[unit].divisor;
        suffix = UNIT_MAP[unit].suffix;
    }

    const dp = Math.max(0, Math.min(10, decimalPlaces));
    return (num / divisor).toFixed(dp) + suffix;
}

// ── Data bar ─────────────────────────────────────────────────────────────────

export function computeDataBarStyle(
    value: any,
    minVal: number,
    maxVal: number,
    positiveColor: string,
    negativeColor: string,
    showAxis: boolean,
    axisColor: string
): { barStyle: React.CSSProperties; showBar: boolean } {
    const num = Number(value);
    if (isNaN(num)) return { barStyle: {}, showBar: false };

    const range = maxVal - minVal;
    if (range === 0) return { barStyle: {}, showBar: false };

    const hasNegative = minVal < 0;
    const axisPercent = hasNegative ? (Math.abs(minVal) / range) * 100 : 0;

    let left: string;
    let width: string;
    let bg: string;

    if (num >= 0) {
        left = `${axisPercent}%`;
        width = `${Math.min(100, (num / range) * 100)}%`;
        bg = positiveColor;
    } else {
        const negWidth = (Math.abs(num) / range) * 100;
        left = `${Math.max(0, axisPercent - negWidth)}%`;
        width = `${negWidth}%`;
        bg = negativeColor;
    }

    return {
        showBar: true,
        barStyle: {
            position: "absolute",
            left,
            width,
            top: "20%",
            height: "60%",
            backgroundColor: bg,
            pointerEvents: "none",
            zIndex: 0
        }
    };
}

// ── Style preset application ──────────────────────────────────────────────────

export type StylePreset = "default" | "minimal" | "boldHeader" | "alternating" | "contrast";

export function applyStylePreset(preset: StylePreset, settings: VisualFormattingSettingsModel): void {
    switch (preset) {
        case "minimal":
            settings.grid.showHorizontalLines.value = false;
            settings.grid.showVerticalLines.value = false;
            settings.columnHeaders.backgroundColor.value = { value: "#ffffff" };
            settings.rowHeaders.backgroundColor.value = { value: "#ffffff" };
            break;
        case "boldHeader":
            settings.columnHeaders.bold.value = true;
            settings.columnHeaders.backgroundColor.value = { value: "#0078d4" };
            settings.columnHeaders.fontColor.value = { value: "#ffffff" };
            break;
        case "alternating":
            settings.grid.alternatingRowBg.value = true;
            settings.grid.alternatingRowColor.value = { value: "#f3f2f1" };
            break;
        case "contrast":
            settings.columnHeaders.backgroundColor.value = { value: "#252423" };
            settings.columnHeaders.fontColor.value = { value: "#ffffff" };
            settings.grid.alternatingRowBg.value = true;
            settings.grid.alternatingRowColor.value = { value: "#f3f2f1" };
            break;
        default:
            break;
    }
}
