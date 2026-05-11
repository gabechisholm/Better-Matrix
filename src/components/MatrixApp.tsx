import * as React from "react";
import { MatrixRowNode, MatrixColNode, MatrixHeaderNode } from "../parser";
import { VisualFormattingSettingsModel } from "../settings";
import { formatValue, applyFormatString, computeDataBarStyle } from "../formatting";

export interface MatrixAppProps {
    rows: MatrixRowNode[];
    columns: MatrixColNode[];
    headerTree: MatrixHeaderNode[];
    settings: VisualFormattingSettingsModel;
    functionValueColIndices?: Set<number>;
    renderKey?: number;
}

// ── Flatten helpers ──────────────────────────────────────────────────────────

function flattenRows(
    nodes: MatrixRowNode[],
    expandedState: Record<string, boolean>,
    showSubtotals: boolean,
    showGrandTotal: boolean,
    showBlankRows: boolean,
    subtotalPosition: string
): MatrixRowNode[] {
    let result: MatrixRowNode[] = [];
    for (const node of nodes) {
        if (node.isGrandTotal && !showGrandTotal) continue;
        if (node.isSubtotal && !node.isGrandTotal && !showSubtotals) continue;
        if (node.isBlankRow && !showBlankRows) continue;

        const isExpanded = expandedState[node.id] ?? node.isExpanded;

        result.push(node);
        if (isExpanded && node.children) {
            result = result.concat(
                flattenRows(node.children, expandedState, showSubtotals, showGrandTotal, showBlankRows, subtotalPosition)
            );
        }
    }
    return result;
}

function sortRows(
    nodes: MatrixRowNode[],
    sortState: { colIndex: number; direction: "asc" | "desc" } | null
): MatrixRowNode[] {
    if (!sortState) return nodes;
    const grandTotals = nodes.filter(n => n.isGrandTotal);
    const regular = nodes.filter(n => !n.isGrandTotal);
    const sorted = [...regular].sort((a, b) => {
        if (a.isSubtotal || b.isSubtotal) return 0;
        const valA = a.values[sortState.colIndex]?.value ?? null;
        const valB = b.values[sortState.colIndex]?.value ?? null;
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        const cmp = valA > valB ? 1 : -1;
        return sortState.direction === "asc" ? cmp : -cmp;
    });
    const sortedWithChildren = sorted.map(node => ({
        ...node,
        children: node.children ? sortRows(node.children, sortState) : undefined
    }));
    return [...sortedWithChildren, ...grandTotals];
}

// ── Header level extraction (colSpan-aware) ──────────────────────────────────

function countVisibleLeaves(
    node: MatrixHeaderNode,
    showColSubtotals: boolean,
    showColGrandTotal: boolean,
    visibleIndices: Set<number>
): number {
    if (node.isGrandTotal && !showColGrandTotal) return 0;
    if (node.isSubtotal && !node.isGrandTotal && !showColSubtotals) return 0;
    if (!node.children || node.children.length === 0) {
        if (node.colIndex !== undefined) return visibleIndices.has(node.colIndex) ? 1 : 0;
        return 0;
    }
    return node.children.reduce(
        (sum, child) => sum + countVisibleLeaves(child, showColSubtotals, showColGrandTotal, visibleIndices),
        0
    );
}

function buildHeaderLevels(
    headerTree: MatrixHeaderNode[],
    showColSubtotals: boolean,
    showColGrandTotal: boolean,
    visibleColIndices: Set<number>
): MatrixHeaderNode[][] {
    const levels: MatrixHeaderNode[][] = [];
    function traverse(nodes: MatrixHeaderNode[], depth: number) {
        if (!levels[depth]) levels[depth] = [];
        for (const node of nodes) {
            if (node.isGrandTotal && !showColGrandTotal) continue;
            if (node.isSubtotal && !node.isGrandTotal && !showColSubtotals) continue;
            if (!node.children || node.children.length === 0) {
                if (node.colIndex !== undefined && !visibleColIndices.has(node.colIndex)) continue;
                levels[depth].push(node);
            } else {
                const span = countVisibleLeaves(node, showColSubtotals, showColGrandTotal, visibleColIndices);
                if (span === 0) continue;
                levels[depth].push({ ...node, colSpan: span });
                traverse(node.children, depth + 1);
            }
        }
    }
    traverse(headerTree, 0);
    return levels;
}

function getVisibleColIndices(
    columns: MatrixColNode[],
    showColSubtotals: boolean,
    showColGrandTotal: boolean,
    functionValueColIndices: Set<number>,
    activeValueMode: "value" | "functionValue"
): Set<number> {
    const hasFn = functionValueColIndices.size > 0;
    const visible = new Set<number>();
    columns.forEach((col, idx) => {
        if (col.isGrandTotal && !showColGrandTotal) return;
        if (col.isSubtotal && !col.isGrandTotal && !showColSubtotals) return;
        // Mode filter — only applies when a Function Value field is bound
        if (hasFn && !col.isSubtotal && !col.isGrandTotal) {
            const isFn = functionValueColIndices.has(idx);
            if (activeValueMode === "value" && isFn) return;
            if (activeValueMode === "functionValue" && !isFn) return;
        }
        visible.add(idx);
    });
    return visible;
}

function computeColRange(rows: MatrixRowNode[], colIndex: number): { min: number; max: number } {
    let min = Infinity, max = -Infinity;
    function visit(nodes: MatrixRowNode[]) {
        for (const n of nodes) {
            const v = Number(n.values[colIndex]?.value);
            if (!isNaN(v)) { if (v < min) min = v; if (v > max) max = v; }
            if (n.children) visit(n.children);
        }
    }
    visit(rows);
    return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max };
}

// ── ResizeHandle ─────────────────────────────────────────────────────────────

interface ResizeHandleProps {
    colKey: string;
    onResize: (colKey: string, delta: number) => void;
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({ colKey, onResize }) => {
    const startX = React.useRef<number>(0);

    const onMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        startX.current = e.clientX;

        const onMouseMove = (ev: MouseEvent) => {
            const delta = ev.clientX - startX.current;
            startX.current = ev.clientX;
            onResize(colKey, delta);
        };

        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    };

    return (
        <div
            onMouseDown={onMouseDown}
            style={{
                position: "absolute",
                right: 0,
                top: 0,
                bottom: 0,
                width: 5,
                cursor: "col-resize",
                userSelect: "none",
                zIndex: 10
            }}
        />
    );
};

// ── MatrixApp ────────────────────────────────────────────────────────────────

export const MatrixApp: React.FC<MatrixAppProps> = ({ rows, columns, headerTree, settings, functionValueColIndices = new Set() }) => {
    const [expandedState, setExpandedState] = React.useState<Record<string, boolean>>({});
    const [sortState, setSortState] = React.useState<{ colIndex: number; direction: "asc" | "desc" } | null>(null);
    const [colWidths, setColWidths] = React.useState<Record<string, number>>({});
    const [activeValueMode, setActiveValueMode] = React.useState<"value" | "functionValue">("value");

    const hasFunctionValue = functionValueColIndices.size > 0;

    const toggleExpand = (id: string) => {
        setExpandedState(prev => {
            const current = prev[id] ?? true;
            return { ...prev, [id]: !current };
        });
    };

    const toggleSort = (colIndex: number) => {
        setSortState(prev => {
            if (prev && prev.colIndex === colIndex) {
                if (prev.direction === "asc") return { colIndex, direction: "desc" };
                return null;
            }
            return { colIndex, direction: "asc" };
        });
    };

    const toggleMode = () => {
        setActiveValueMode(prev => prev === "value" ? "functionValue" : "value");
        setSortState(null); // reset sort when switching modes
    };

    const handleResize = React.useCallback((colKey: string, delta: number) => {
        setColWidths(prev => {
            const current = prev[colKey] ?? (colKey === "row-header" ? 150 : 100);
            return { ...prev, [colKey]: Math.max(40, current + delta) };
        });
    }, []);

    const showRowSubtotals = settings.rowSubtotals.show.value;
    const showColSubtotals = settings.columnSubtotals.show.value;
    const showRowGrandTotal = settings.rowGrandTotal.show.value;
    const showColGrandTotal = settings.columnGrandTotal.show.value;
    const showBlankRows = settings.blankRows.showBlankRows.value;
    const rowSubtotalPosition = String((settings.rowSubtotals.position.value as any)?.value ?? "bottom");

    const flatRows = React.useMemo(() => {
        const sorted = sortRows(rows, sortState);
        return flattenRows(sorted, expandedState, showRowSubtotals, showRowGrandTotal, showBlankRows, rowSubtotalPosition);
    }, [rows, expandedState, sortState, showRowSubtotals, showRowGrandTotal, showBlankRows, rowSubtotalPosition]);

    const visibleColIndices = React.useMemo(
        () => getVisibleColIndices(columns, showColSubtotals, showColGrandTotal, functionValueColIndices, activeValueMode),
        [columns, showColSubtotals, showColGrandTotal, functionValueColIndices, activeValueMode]
    );

    const headerLevels = React.useMemo(
        () => buildHeaderLevels(headerTree, showColSubtotals, showColGrandTotal, visibleColIndices),
        [headerTree, showColSubtotals, showColGrandTotal, visibleColIndices]
    );

    const colRanges = React.useMemo(() => {
        if (!settings.cellElements.showDataBars.value) return [];
        return columns.map((_, idx) => computeColRange(rows, idx));
    }, [rows, columns, settings.cellElements.showDataBars.value]);

    const S = settings;
    const grd = S.grid;
    const vals = S.values;
    const colH = S.columnHeaders;
    const rowH = S.rowHeaders;
    const bars = S.cellElements;

    // ── Preset overrides ─────────────────────────────────────────────────────
    // Each preset returns a partial set of computed style values that override
    // whatever the individual format-pane sliders say.
    const activePreset = String((S.layoutPresets.style.value as any)?.value ?? "default");

    interface PresetStyles {
        containerBg: string;
        valueFontColor: string;
        valueBg: string;
        rowHeaderFontColor: string;
        rowHeaderBg: string;
        colHeaderFontColor: string;
        colHeaderBg: string;
        colHeaderFontWeight: number;
        hLine: string;
        vLine: string;
        altRowEnabled: boolean;
        altRowColor: string;
        subtotalBg: string;
        subtotalColor: string;
        grandTotalBg: string;
        grandTotalColor: string;
    }

    function resolvePreset(): PresetStyles {
        // Base values from individual settings
        const base: PresetStyles = {
            containerBg: "#ffffff",
            valueFontColor: vals.fontColor.value?.value ?? "#252423",
            valueBg: vals.backgroundColor.value?.value ?? "#ffffff",
            rowHeaderFontColor: rowH.fontColor.value?.value ?? "#252423",
            rowHeaderBg: rowH.backgroundColor.value?.value ?? "#ffffff",
            colHeaderFontColor: colH.fontColor.value?.value ?? "#252423",
            colHeaderBg: colH.backgroundColor.value?.value ?? "#ffffff",
            colHeaderFontWeight: colH.bold.value ? 700 : 400,
            hLine: grd.showHorizontalLines.value
                ? `${Math.max(1, Number(grd.horizontalLineWeight.value))}px solid ${grd.horizontalLineColor.value?.value ?? "#edebe9"}`
                : "none",
            vLine: grd.showVerticalLines.value
                ? `${Math.max(1, Number(grd.verticalLineWeight.value))}px solid ${grd.verticalLineColor.value?.value ?? "#edebe9"}`
                : "none",
            altRowEnabled: grd.alternatingRowBg.value,
            altRowColor: grd.alternatingRowColor.value?.value ?? "#f3f2f1",
            subtotalBg: S.rowSubtotals.backgroundColor.value?.value ?? "#f3f2f1",
            subtotalColor: S.rowSubtotals.fontColor.value?.value ?? "#252423",
            grandTotalBg: S.rowGrandTotal.backgroundColor.value?.value ?? "#f3f2f1",
            grandTotalColor: S.rowGrandTotal.fontColor.value?.value ?? "#252423"
        };

        switch (activePreset) {
            case "minimal":
                return {
                    ...base,
                    containerBg: "#ffffff",
                    colHeaderBg: "#ffffff",
                    colHeaderFontColor: "#605e5c",
                    colHeaderFontWeight: 400,
                    rowHeaderBg: "#ffffff",
                    rowHeaderFontColor: "#605e5c",
                    valueBg: "#ffffff",
                    hLine: "1px solid #f3f2f1",
                    vLine: "none",
                    altRowEnabled: false,
                    altRowColor: "#f9f8f7",
                    subtotalBg: "#ffffff",
                    subtotalColor: "#605e5c",
                    grandTotalBg: "#ffffff",
                    grandTotalColor: "#252423"
                };

            case "boldHeader":
                return {
                    ...base,
                    colHeaderBg: "#0e1e40",
                    colHeaderFontColor: "#ffffff",
                    colHeaderFontWeight: 700,
                    rowHeaderBg: "#f3f2f1",
                    rowHeaderFontColor: "#252423",
                    hLine: "1px solid #d0cece",
                    vLine: "none",
                    subtotalBg: "#e1dfdd",
                    subtotalColor: "#252423",
                    grandTotalBg: "#0e1e40",
                    grandTotalColor: "#ffffff"
                };

            case "alternating":
                return {
                    ...base,
                    colHeaderBg: "#2b5797",
                    colHeaderFontColor: "#ffffff",
                    colHeaderFontWeight: 700,
                    rowHeaderBg: "#ffffff",
                    hLine: "none",
                    vLine: "none",
                    altRowEnabled: true,
                    altRowColor: "#dae3f3",
                    subtotalBg: "#b4c7e7",
                    subtotalColor: "#0e1e40",
                    grandTotalBg: "#2b5797",
                    grandTotalColor: "#ffffff"
                };

            case "contrast":
                return {
                    ...base,
                    containerBg: "#1b1b1b",
                    colHeaderBg: "#111111",
                    colHeaderFontColor: "#f0f0f0",
                    colHeaderFontWeight: 700,
                    rowHeaderBg: "#1b1b1b",
                    rowHeaderFontColor: "#c8c8c8",
                    valueFontColor: "#e0e0e0",
                    valueBg: "#1b1b1b",
                    hLine: "1px solid #3a3a3a",
                    vLine: "1px solid #3a3a3a",
                    altRowEnabled: true,
                    altRowColor: "#252525",
                    subtotalBg: "#2d2d2d",
                    subtotalColor: "#c8c8c8",
                    grandTotalBg: "#111111",
                    grandTotalColor: "#f0f0f0"
                };

            default: // "default"
                return base;
        }
    }

    const P = resolvePreset();

    const rowPad = Math.max(0, Number(grd.rowPadding.value));
    const hLineStyle = P.hLine;
    const vLineStyle = P.vLine;

    const containerStyle: React.CSSProperties = {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily: vals.fontFamily.value,
        fontSize: `${Math.max(8, Number(vals.fontSize.value))}px`,
        color: P.valueFontColor,
        backgroundColor: P.containerBg
    };

    const tableStyle: React.CSSProperties = {
        borderCollapse: "collapse",
        tableLayout: "fixed"
    };

    const thBaseStyle: React.CSSProperties = {
        padding: `${rowPad + 3}px 8px`,
        fontFamily: colH.fontFamily.value,
        fontSize: `${Math.max(8, Number(colH.fontSize.value))}px`,
        fontWeight: P.colHeaderFontWeight,
        fontStyle: colH.italic.value ? "italic" : "normal",
        color: P.colHeaderFontColor,
        backgroundColor: P.colHeaderBg,
        whiteSpace: colH.wordWrap.value ? "normal" : "nowrap",
        borderBottom: hLineStyle,
        borderLeft: vLineStyle,
        position: "sticky" as const,
        top: 0,
        zIndex: 2,
        overflow: "hidden",
        textOverflow: "ellipsis"
    };

    const rowHeaderBaseStyle = (level: number): React.CSSProperties => ({
        padding: `${rowPad + 3}px 8px`,
        paddingLeft: rowH.steppedLayout.value ? `${level * Math.max(0, Number(rowH.steppedLayoutIndent.value)) + 8}px` : "8px",
        fontFamily: rowH.fontFamily.value,
        fontSize: `${Math.max(8, Number(rowH.fontSize.value))}px`,
        fontWeight: rowH.bold.value ? 700 : 400,
        fontStyle: rowH.italic.value ? "italic" : "normal",
        color: P.rowHeaderFontColor,
        backgroundColor: P.rowHeaderBg,
        whiteSpace: rowH.wordWrap.value ? "normal" : "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        position: "sticky" as const,
        left: 0,
        zIndex: 2,
        borderBottom: hLineStyle,
        borderRight: vLineStyle
    });

    const valueCellStyle = (colIdx: number): React.CSSProperties => {
        const specificIdx = Number(S.specificColumn.applyToColumnIndex.value);
        const useSpecific = specificIdx > 0 && colIdx === specificIdx;
        const specificAlign = useSpecific ? String((S.specificColumn.textAlignment.value as any)?.value ?? "default") : "default";
        let align = String((vals.textAlignment.value as any)?.value ?? "right");
        if (useSpecific && specificAlign !== "default") align = specificAlign;
        return {
            padding: `${rowPad + 3}px 8px`,
            fontFamily: vals.fontFamily.value,
            fontSize: `${Math.max(8, Number(vals.fontSize.value))}px`,
            fontWeight: vals.bold.value ? 700 : 400,
            fontStyle: vals.italic.value ? "italic" : "normal",
            color: useSpecific && S.specificColumn.fontColor.value?.value
                ? S.specificColumn.fontColor.value?.value
                : P.valueFontColor,
            backgroundColor: useSpecific && S.specificColumn.backgroundColor.value?.value
                ? S.specificColumn.backgroundColor.value?.value
                : P.valueBg,
            textAlign: align as any,
            whiteSpace: vals.wordWrap.value ? "normal" : "nowrap",
            borderBottom: hLineStyle,
            borderLeft: vLineStyle,
            position: "relative",
            overflow: "hidden"
        };
    };

    const subtotalRowStyle = (isGrand: boolean): React.CSSProperties => {
        const card = isGrand ? S.rowGrandTotal : S.rowSubtotals;
        return {
            fontFamily: card.fontFamily.value,
            fontSize: `${Math.max(8, Number(card.fontSize.value))}px`,
            fontWeight: card.bold.value ? 700 : 400,
            color: isGrand ? P.grandTotalColor : P.subtotalColor,
            backgroundColor: isGrand ? P.grandTotalBg : P.subtotalBg
        };
    };

    const colSubtotalCellStyle = (isGrand: boolean): React.CSSProperties => {
        const card = isGrand ? S.columnGrandTotal : S.columnSubtotals;
        return {
            fontFamily: card.fontFamily.value,
            fontSize: `${Math.max(8, Number(card.fontSize.value))}px`,
            fontWeight: card.bold.value ? 700 : 400,
            color: isGrand ? P.grandTotalColor : P.subtotalColor,
            backgroundColor: isGrand ? P.grandTotalBg : P.subtotalBg
        };
    };

    const subtotalLabel = (isGrand: boolean) =>
        isGrand
            ? String(S.rowGrandTotal.label.value || "Total")
            : String(S.rowSubtotals.label.value || "Total");

    const displayUnits = String((vals.displayUnits.value as any)?.value ?? "auto");
    const decimalPlaces = Math.max(0, Math.min(10, Number(vals.decimalPlaces.value)));
    const showDataBars = bars.showDataBars.value;
    const posBarColor = bars.positiveBarColor.value?.value ?? "#2d7dd2";
    const negBarColor = bars.negativeBarColor.value?.value ?? "#e63946";
    const showBarAxis = bars.showBarAxis.value;
    const barAxisColor = bars.barAxisColor.value?.value ?? "#8a8886";
    const altRowEnabled = P.altRowEnabled;
    const altRowColor = P.altRowColor;

    const numHeaderRows = headerLevels.length || 1;
    const visibleColumns = columns.map((col, idx) => ({ col, idx })).filter(({ idx }) => visibleColIndices.has(idx));

    const rowHeaderWidth = colWidths["row-header"] ?? 150;

    // ── Function Button settings
    const fb = S.functionButton;
    const showFunctionButton = hasFunctionValue && fb.show.value;
    const fbValueLabel    = String(fb.valueLabel.value    || "Values");
    const fbFunctionLabel = String(fb.functionLabel.value || "Function Value");
    const fbButtonLabel   = activeValueMode === "value" ? fbFunctionLabel : fbValueLabel;
    const fbBtnStyle: React.CSSProperties = {
        fontSize: `${Math.max(8, Number(fb.fontSize.value))}px`,
        color: fb.fontColor.value?.value ?? "#ffffff",
        backgroundColor: fb.backgroundColor.value?.value ?? "#2b5797",
        border: `1px solid ${fb.borderColor.value?.value ?? "#1e3f7a"}`,
        borderRadius: 4,
        padding: "4px 12px",
        cursor: "pointer",
        fontFamily: vals.fontFamily.value,
        fontWeight: 600,
        letterSpacing: "0.02em",
        transition: "opacity 0.15s",
        userSelect: "none" as const
    };

    return (
        <div style={containerStyle}>
            {showFunctionButton && (
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", padding: "4px 8px", flexShrink: 0, backgroundColor: P.containerBg }}>
                    <button style={fbBtnStyle} onClick={toggleMode}>
                        {activeValueMode === "value"
                            ? `► ${fbButtonLabel}`
                            : `◄ ${fbButtonLabel}`
                        }
                    </button>
                </div>
            )}
            <div style={{ flex: 1, overflow: "auto" }}>
            <table style={tableStyle}>
                <colgroup>
                    <col style={{ width: rowHeaderWidth }} />
                    {visibleColumns.map(({ idx }) => (
                        <col key={idx} style={{ width: colWidths[String(idx)] ?? 100 }} />
                    ))}
                </colgroup>
                <thead>
                    {headerLevels.length === 0 ? (
                        <tr>
                            <th style={{ ...thBaseStyle, textAlign: "left", left: 0, zIndex: 3, position: "sticky", width: rowHeaderWidth }}>
                                Row
                                <ResizeHandle colKey="row-header" onResize={handleResize} />
                            </th>
                        </tr>
                    ) : headerLevels.map((levelNodes, levelIdx) => (
                        <tr key={levelIdx}>
                            {levelIdx === headerLevels.length - 1 && (
                                <th style={{ ...thBaseStyle, textAlign: "left", left: 0, zIndex: 3, position: "sticky", width: rowHeaderWidth }}>
                                    Row
                                    <ResizeHandle colKey="row-header" onResize={handleResize} />
                                </th>
                            )}
                            {levelIdx < headerLevels.length - 1 && levelIdx === 0 && (
                                <th
                                    style={{ ...thBaseStyle, textAlign: "left", left: 0, zIndex: 3, position: "sticky", width: rowHeaderWidth }}
                                    rowSpan={numHeaderRows - 1 || 1}
                                >
                                    <ResizeHandle colKey="row-header" onResize={handleResize} />
                                </th>
                            )}
                            {levelNodes.map((node, nodeIdx) => {
                                const isLeaf = node.colSpan === 1 && node.colIndex !== undefined;
                                const headerAlign = String((colH.textAlignment.value as any)?.value ?? "right");
                                const isColSubtotal = !!node.isSubtotal;
                                const isColGrandTotal = !!node.isGrandTotal;

                                let headerStyle = { ...thBaseStyle };
                                if (isColSubtotal) {
                                    const colSubCard = isColGrandTotal ? S.columnGrandTotal : S.columnSubtotals;
                                    headerStyle = {
                                        ...headerStyle,
                                        fontFamily: colSubCard.fontFamily.value,
                                        fontSize: `${Math.max(8, Number(colSubCard.fontSize.value))}px`,
                                        fontWeight: colSubCard.bold.value ? 700 : 400,
                                        color: colSubCard.fontColor.value?.value ?? "#252423",
                                        backgroundColor: colSubCard.backgroundColor.value?.value ?? "#f3f2f1"
                                    };
                                }

                                const headerLabel = isColGrandTotal
                                    ? String(S.columnGrandTotal.label.value || node.value || "Total")
                                    : isColSubtotal
                                        ? String(S.columnSubtotals.label.value || node.value || "Total")
                                        : node.value;

                                const colKey = isLeaf ? String(node.colIndex) : `h-${levelIdx}-${nodeIdx}`;

                                return (
                                    <th
                                        key={`${levelIdx}-${nodeIdx}`}
                                        colSpan={node.colSpan}
                                        style={{
                                            ...headerStyle,
                                            textAlign: node.colSpan > 1 ? "center" : (headerAlign as any),
                                            cursor: isLeaf ? "pointer" : "default",
                                            userSelect: "none",
                                            position: "relative"
                                        }}
                                        onClick={() => {
                                            if (isLeaf) toggleSort(node.colIndex!);
                                        }}
                                    >
                                        {headerLabel}
                                        {isLeaf && sortState?.colIndex === node.colIndex
                                            ? (sortState.direction === "asc" ? " ▲" : " ▼")
                                            : ""}
                                        {isLeaf && (
                                            <ResizeHandle colKey={colKey} onResize={handleResize} />
                                        )}
                                    </th>
                                );
                            })}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {flatRows.map((row, rowIdx) => {
                        const isSub = row.isSubtotal && !row.isGrandTotal;
                        const isGrand = row.isGrandTotal;
                        const rowSubStyle = (isSub || isGrand) ? subtotalRowStyle(isGrand) : null;
                        const rowLabel = (isSub || isGrand) ? subtotalLabel(isGrand) : null;
                        const altBg = altRowEnabled && !isSub && !isGrand && rowIdx % 2 === 1
                            ? altRowColor
                            : undefined;

                        return (
                            <tr key={row.id}>
                                <td
                                    style={{
                                        ...rowHeaderBaseStyle(row.level),
                                        ...(rowSubStyle ? {
                                            fontFamily: rowSubStyle.fontFamily,
                                            fontSize: rowSubStyle.fontSize,
                                            fontWeight: rowSubStyle.fontWeight,
                                            color: rowSubStyle.color,
                                            backgroundColor: rowSubStyle.backgroundColor
                                        } : {}),
                                        ...(altBg && !rowSubStyle ? { backgroundColor: altBg } : {}),
                                        paddingLeft: rowH.steppedLayout.value
                                            ? `${row.level * Math.max(0, Number(rowH.steppedLayoutIndent.value)) + 8}px`
                                            : "8px",
                                        width: rowHeaderWidth
                                    }}
                                >
                                    {row.isExpandable && (
                                        <span
                                            style={{
                                                display: "inline-block",
                                                width: 12,
                                                height: 12,
                                                lineHeight: "10px",
                                                textAlign: "center",
                                                border: `1px solid ${rowH.expandCollapseIconColor.value?.value ?? "#323130"}`,
                                                marginRight: 6,
                                                fontSize: 10,
                                                color: rowH.expandCollapseIconColor.value?.value ?? "#323130",
                                                cursor: "pointer",
                                                verticalAlign: "middle",
                                                userSelect: "none",
                                                flexShrink: 0
                                            }}
                                            onClick={() => toggleExpand(row.id)}
                                        >
                                            {(expandedState[row.id] ?? row.isExpanded) ? "−" : "+"}
                                        </span>
                                    )}
                                    {rowLabel !== null ? rowLabel : (row.value ?? "(Blank)")}
                                </td>

                                {visibleColumns.map(({ col, idx: colIdx }) => {
                                    const isColSub = !!col.isSubtotal;
                                    const valObj = row.values[colIdx];
                                    const rawVal = valObj?.value;
                                    // Always try the measure's own format string first (covers both
                                    // Values and Function Value columns).  Fall back to the user's
                                    // display-units / decimal-places settings only when no format
                                    // string is present or it isn't recognised.
                                    const formatted: string =
                                        applyFormatString(rawVal, col.formatString)
                                        ?? formatValue(rawVal, displayUnits, decimalPlaces);
                                    const cellStyle = valueCellStyle(colIdx);
                                    const mergedCellStyle: React.CSSProperties = { ...cellStyle };

                                    if (rowSubStyle) {
                                        mergedCellStyle.fontFamily = rowSubStyle.fontFamily;
                                        mergedCellStyle.fontSize = rowSubStyle.fontSize;
                                        mergedCellStyle.fontWeight = rowSubStyle.fontWeight;
                                        mergedCellStyle.color = rowSubStyle.color;
                                        mergedCellStyle.backgroundColor = rowSubStyle.backgroundColor;
                                    } else if (altBg) {
                                        mergedCellStyle.backgroundColor = altBg;
                                    }

                                    const isColGrand = !!col.isGrandTotal;
                                    if (isColSub) {
                                        const colSubStyle = colSubtotalCellStyle(isColGrand);
                                        mergedCellStyle.fontFamily = colSubStyle.fontFamily;
                                        mergedCellStyle.fontSize = colSubStyle.fontSize;
                                        mergedCellStyle.fontWeight = colSubStyle.fontWeight;
                                        mergedCellStyle.color = colSubStyle.color;
                                        mergedCellStyle.backgroundColor = colSubStyle.backgroundColor;
                                    }

                                    let barEl: React.ReactNode = null;
                                    if (showDataBars && colRanges[colIdx] && !isColSub) {
                                        const { min, max } = colRanges[colIdx];
                                        const { barStyle, showBar } = computeDataBarStyle(
                                            rawVal, min, max,
                                            posBarColor, negBarColor,
                                            showBarAxis, barAxisColor
                                        );
                                        if (showBar) {
                                            barEl = <div style={barStyle as React.CSSProperties} />;
                                        }
                                    }

                                    return (
                                        <td key={colIdx} style={{ ...mergedCellStyle, width: colWidths[String(colIdx)] ?? 100 }}>
                                            {barEl}
                                            <span style={{ position: "relative", zIndex: 1 }}>{formatted}</span>
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            </div>
        </div>
    );
};
