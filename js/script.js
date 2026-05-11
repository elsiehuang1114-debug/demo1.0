const initialTimestamp = Date.now();
const SORTING_KEYS = ["pool", "mostImportant", "medium", "notImportant"];
const SORTING_ZONE_IDS = {
    factorPool: "pool",
    mostImportantZone: "mostImportant",
    mediumZone: "medium",
    notImportantZone: "notImportant"
};
const SORTING_ZONE_LABELS = {
    pool: "Unsorted",
    mostImportant: "Important",
    medium: "Medium",
    notImportant: "Not Important"
};

let sortableInstances = [];
let useLegacyDragDrop = false;

const state = {
    currentStep: 1,
    form: {
        major: "",
        interest: "",
        skills: "",
        expectedSalary: "",
        expectedJobEase: "",
        expectedDifficulty: "",
        initialCareerChoice: "",
        changedDecision: "No",
        confidenceBefore: "",
        revisedCareerChoice: "",
        mostInfluentialFactor: "",
        changeReason: ""
    },
    sorting: {
        pool: [],
        mostImportant: [],
        medium: [],
        notImportant: [],
        moveCount: 0
    },
    sortingResearch: {
        sessionStartedAt: "",
        sessionStartedAtMs: null,
        sessionEndedAt: "",
        sessionEndedAtMs: null,
        totalSortingDurationMs: 0,
        firstDragStartedAt: "",
        firstDragStartedAtMs: null,
        completed: false,
        sortingInteractionLog: [],
        zoneChanges: [],
        perFactorMoveCounts: {},
        factorStats: {},
        finalZoneByFactor: {},
        finalSortingResult: {
            important: [],
            medium: [],
            notImportant: [],
            pool: []
        },
        hesitationIndicators: {},
        reconsiderationMetrics: {},
        reflectionResponses: {
            hardestFactorToRank: "",
            feltUncertain: "",
            reasonForChanges: "",
            additionalComment: ""
        }
    },
    meta: {
        startedAt: new Date(initialTimestamp).toISOString(),
        startedAtMs: initialTimestamp,
        stepEnteredAt: initialTimestamp,
        timePerStep: {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0,
            6: 0
        }
    }
};

document.addEventListener("DOMContentLoaded", () => {
    initialiseState();
    useLegacyDragDrop = typeof Sortable === "undefined";
    renderFactorCards();
    setupSortingInteractions();
    renderCareers();
    populateFactorSelect("sortingHardestFactor");
    populateCareerSelect("revisedCareerChoice");
    setupDecisionChangeListener();
    toggleRevisedChoice(state.form.changedDecision);
    updateSortingResearchFinalState();
    renderSortingReflection();
    updateStepVisibility();
});

function initialiseState() {
    state.sorting.pool = FACTORS.map((factor) => factor.id);
    state.sortingResearch.perFactorMoveCounts = FACTORS.reduce((counts, factor) => {
        counts[factor.id] = 0;
        return counts;
    }, {});
    updateSortingResearchFinalState();
}

function setupDecisionChangeListener() {
    const changeDecision = document.getElementById("changeDecision");
    if (!changeDecision) {
        return;
    }

    changeDecision.addEventListener("change", () => {
        state.form.changedDecision = changeDecision.value;
        toggleRevisedChoice(changeDecision.value);
    });
}

function populateFactorSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) {
        return;
    }

    const currentValue = select.value || state.sortingResearch.reflectionResponses.hardestFactorToRank;
    select.innerHTML = "";

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Select one";
    select.appendChild(defaultOption);

    FACTORS.forEach((factor) => {
        const option = document.createElement("option");
        option.value = factor.id;
        option.textContent = factor.title;
        select.appendChild(option);
    });

    if (currentValue && FACTORS.some((factor) => factor.id === currentValue)) {
        select.value = currentValue;
    }
}

function beginSortingSession() {
    if (state.sortingResearch.sessionStartedAtMs) {
        return;
    }

    const now = Date.now();
    state.sortingResearch.sessionStartedAtMs = now;
    state.sortingResearch.sessionStartedAt = new Date(now).toISOString();
}

function endSortingSession() {
    beginSortingSession();
    syncSortingStateFromDom();

    const now = Date.now();
    state.sortingResearch.sessionEndedAtMs = now;
    state.sortingResearch.sessionEndedAt = new Date(now).toISOString();
    state.sortingResearch.completed = true;
    updateSortingResearchFinalState(now);
}

function markFirstDragStarted() {
    beginSortingSession();

    if (state.sortingResearch.firstDragStartedAtMs) {
        return;
    }

    const now = Date.now();
    state.sortingResearch.firstDragStartedAtMs = now;
    state.sortingResearch.firstDragStartedAt = new Date(now).toISOString();
}

function recordStepDuration(stepNumber) {
    const now = Date.now();
    const stepKey = String(stepNumber);

    if (typeof state.meta.timePerStep[stepKey] !== "number") {
        state.meta.timePerStep[stepKey] = 0;
    }

    state.meta.timePerStep[stepKey] += Math.max(0, now - state.meta.stepEnteredAt);
    state.meta.stepEnteredAt = now;
}

function toggleRevisedChoice(value) {
    const revisedChoiceBlock = document.getElementById("revisedChoiceBlock");
    const revisedCareerChoice = document.getElementById("revisedCareerChoice");
    const shouldShow = value === "Yes";

    if (revisedChoiceBlock) {
        revisedChoiceBlock.classList.toggle("hidden", !shouldShow);
    }

    if (!shouldShow) {
        state.form.revisedCareerChoice = "";
        if (revisedCareerChoice) {
            revisedCareerChoice.value = "";
        }
    }
}

function populateCareerSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) {
        return;
    }

    const currentValue = state.form[selectId] || select.value;
    select.innerHTML = "";

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Select a revised career";
    select.appendChild(defaultOption);

    getRankedCareers().forEach(({ career }) => {
        const option = document.createElement("option");
        option.value = career.id;
        option.textContent = career.title;
        select.appendChild(option);
    });

    if (currentValue && CAREERS.some((career) => career.id === currentValue)) {
        select.value = currentValue;
    }
}

function goToStep(stepNumber) {
    persistCurrentInputs();

    if (!validateBeforeStepChange(stepNumber)) {
        return;
    }

    if (state.currentStep === 3 && stepNumber > 3) {
        endSortingSession();
    }

    recordStepDuration(state.currentStep);
    state.currentStep = stepNumber;

    if (stepNumber === 3) {
        beginSortingSession();
        renderSortingReflection();
    }

    if (stepNumber === 4) {
        renderCareers();
    }

    if (stepNumber === 5) {
        renderCareerDetail();
        populateCareerSelect("revisedCareerChoice");
        toggleRevisedChoice(state.form.changedDecision);
    }

    if (stepNumber === 6) {
        renderSummary();
        renderIgnoredInsights();
    }

    updateStepVisibility();
}

function validateBeforeStepChange(stepNumber) {
    if (stepNumber === 4) {
        const hasSortedCards =
            state.sorting.mostImportant.length > 0 ||
            state.sorting.medium.length > 0 ||
            state.sorting.notImportant.length > 0;

        if (!hasSortedCards) {
            alert("Please sort at least one factor before continuing.");
            return false;
        }
    }

    if (stepNumber === 5 && !state.form.initialCareerChoice) {
        alert("Please choose a career before continuing.");
        return false;
    }

    if (stepNumber === 6 && state.form.changedDecision === "Yes" && !state.form.revisedCareerChoice) {
        alert("Please choose your revised career before finishing.");
        return false;
    }

    return true;
}

function persistCurrentInputs() {
    const major = document.getElementById("major");
    const interest = document.getElementById("interest");
    const skills = document.getElementById("skills");
    const expectedSalary = document.getElementById("expectedSalary");
    const expectedJobEase = document.getElementById("expectedJobEase");
    const expectedDifficulty = document.getElementById("expectedDifficulty");
    const changeDecision = document.getElementById("changeDecision");
    const confidenceBefore = document.getElementById("confidenceBefore");
    const revisedCareerChoice = document.getElementById("revisedCareerChoice");
    const mostInfluentialFactor = document.getElementById("mostInfluentialFactor");
    const changeReason = document.getElementById("changeReason");
    const sortingHardestFactor = document.getElementById("sortingHardestFactor");
    const sortingUncertainty = document.getElementById("sortingUncertainty");
    const repeatedMoveReason = document.getElementById("repeatedMoveReason");
    const sortingAdditionalComment = document.getElementById("sortingAdditionalComment");

    if (major) {
        state.form.major = major.value;
    }
    if (interest) {
        state.form.interest = interest.value;
    }
    if (skills) {
        state.form.skills = skills.value;
    }
    if (expectedSalary) {
        state.form.expectedSalary = expectedSalary.value.trim();
    }
    if (expectedJobEase) {
        state.form.expectedJobEase = expectedJobEase.value;
    }
    if (expectedDifficulty) {
        state.form.expectedDifficulty = expectedDifficulty.value;
    }
    if (changeDecision) {
        state.form.changedDecision = changeDecision.value;
        toggleRevisedChoice(state.form.changedDecision);
    }
    if (confidenceBefore) {
        state.form.confidenceBefore = confidenceBefore.value;
    }
    if (revisedCareerChoice) {
        state.form.revisedCareerChoice = revisedCareerChoice.value;
    }
    if (mostInfluentialFactor) {
        state.form.mostInfluentialFactor = mostInfluentialFactor.value;
    }
    if (changeReason) {
        state.form.changeReason = changeReason.value.trim();
    }
    if (sortingHardestFactor) {
        state.sortingResearch.reflectionResponses.hardestFactorToRank = sortingHardestFactor.value;
    }
    if (sortingUncertainty) {
        state.sortingResearch.reflectionResponses.feltUncertain = sortingUncertainty.value;
    }
    if (repeatedMoveReason) {
        state.sortingResearch.reflectionResponses.reasonForChanges = repeatedMoveReason.value.trim();
    }
    if (sortingAdditionalComment) {
        state.sortingResearch.reflectionResponses.additionalComment = sortingAdditionalComment.value.trim();
    }
}

function updateStepVisibility() {
    document.querySelectorAll(".step").forEach((step) => {
        step.classList.remove("active");
    });

    const currentSection = document.getElementById(`step${state.currentStep}`);
    if (currentSection) {
        currentSection.classList.add("active");
    }
}

function renderFactorCards() {
    renderZone("factorPool", state.sorting.pool, false);
    renderZone("mostImportantZone", state.sorting.mostImportant, true);
    renderZone("mediumZone", state.sorting.medium, true);
    renderZone("notImportantZone", state.sorting.notImportant, true);
}

function renderZone(containerId, factorIds, showEmptyHint) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }

    container.innerHTML = "";
    container.dataset.emptyText = showEmptyHint ? "Drop cards here" : "Unsorted factors";

    factorIds.forEach((factorId) => {
        const factor = FACTORS.find((item) => item.id === factorId);
        if (!factor) {
            return;
        }

        const card = document.createElement("div");
        card.className = "factor-card draggable-card";
        card.draggable = useLegacyDragDrop;
        card.setAttribute("role", "listitem");
        card.dataset.factorId = factor.id;
        card.innerHTML = `
            <div class="card-top">
                <div class="card-title">${factor.title}</div>
                <div class="mini-badge">${factor.type}</div>
            </div>
            <div class="card-desc">${factor.description}</div>
        `;

        if (useLegacyDragDrop) {
            card.addEventListener("dragstart", handleDragStart);
        }
        container.appendChild(card);
    });
}

function setupSortingInteractions() {
    if (useLegacyDragDrop) {
        setupLegacyDropZones();
        return;
    }

    setupSortableSorting();
}

function setupSortableSorting() {
    sortableInstances.forEach((sortable) => sortable.destroy());
    sortableInstances = [];

    const containers = document.querySelectorAll(".drop-zone, .factor-pool");

    containers.forEach((container) => {
        const sortable = Sortable.create(container, {
            group: {
                name: "career-factor-sorting",
                pull: true,
                put: true
            },
            animation: 150,
            draggable: ".factor-card",
            ghostClass: "sortable-ghost",
            chosenClass: "sortable-chosen",
            dragClass: "sortable-drag",
            fallbackOnBody: true,
            swapThreshold: 0.65,
            delay: 90,
            delayOnTouchOnly: true,
            touchStartThreshold: 5,
            onStart: handleSortableStart,
            onEnd: handleSortableEnd
        });

        sortableInstances.push(sortable);
    });
}

function setupLegacyDropZones() {
    const dropZones = document.querySelectorAll(".drop-zone, .factor-pool");

    dropZones.forEach((zone) => {
        zone.addEventListener("dragover", (event) => {
            event.preventDefault();
            zone.classList.add("drag-over");
        });

        zone.addEventListener("dragleave", () => {
            zone.classList.remove("drag-over");
        });

        zone.addEventListener("drop", handleDrop);
    });
}

function handleDragStart(event) {
    markFirstDragStarted();
    event.dataTransfer.setData("text/plain", event.target.dataset.factorId);
}

function handleSortableStart() {
    markFirstDragStarted();
}

function handleSortableEnd(event) {
    const factorId = event.item ? event.item.dataset.factorId : "";
    const fromZone = getSortingKeyForTarget(event.from.id);
    const toZone = getSortingKeyForTarget(event.to.id);
    const fromIndex = getSortableEventIndex(event, "old");
    const toIndex = getSortableEventIndex(event, "new");
    const changedPosition = fromZone !== toZone || fromIndex !== toIndex;

    syncSortingStateFromDom();

    if (!factorId || !changedPosition) {
        updateSortingResearchFinalState();
        renderSortingReflection();
        return;
    }

    recordSortingMove({
        factorId,
        fromZone,
        toZone,
        fromIndex,
        toIndex
    });
}

function getSortableEventIndex(event, direction) {
    const draggableKey = direction === "old" ? "oldDraggableIndex" : "newDraggableIndex";
    const indexKey = direction === "old" ? "oldIndex" : "newIndex";
    const index = event[draggableKey] ?? event[indexKey];
    return typeof index === "number" ? index : -1;
}

function handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove("drag-over");

    const factorId = event.dataTransfer.getData("text/plain");
    const targetId = event.currentTarget.id;

    if (moveFactorToZone(factorId, targetId)) {
        renderFactorCards();
    }
}

function moveFactorToZone(factorId, targetId) {
    const targetKey = getSortingKeyForTarget(targetId);
    const currentKey = getSortingKeyForFactor(factorId);
    const fromIndex = currentKey ? state.sorting[currentKey].indexOf(factorId) : -1;

    if (!targetKey || !currentKey || currentKey === targetKey) {
        return false;
    }

    removeFactorFromAllZones(factorId);

    state.sorting[targetKey].push(factorId);
    recordSortingMove({
        factorId,
        fromZone: currentKey,
        toZone: targetKey,
        fromIndex,
        toIndex: state.sorting[targetKey].length - 1
    });
    return true;
}

function removeFactorFromAllZones(factorId) {
    SORTING_KEYS.forEach((key) => {
        state.sorting[key] = state.sorting[key].filter((id) => id !== factorId);
    });
}

function getSortingKeyForTarget(targetId) {
    return SORTING_ZONE_IDS[targetId] || "";
}

function getSortingKeyForFactor(factorId) {
    return SORTING_KEYS.find((key) => state.sorting[key].includes(factorId)) || "";
}

function syncSortingStateFromDom() {
    Object.keys(SORTING_ZONE_IDS).forEach((containerId) => {
        const container = document.getElementById(containerId);
        const sortingKey = SORTING_ZONE_IDS[containerId];

        if (!container) {
            return;
        }

        state.sorting[sortingKey] = Array.from(container.querySelectorAll(".factor-card"))
            .map((card) => card.dataset.factorId)
            .filter(Boolean);
    });
}

function recordSortingMove({ factorId, fromZone, toZone, fromIndex, toIndex }) {
    beginSortingSession();

    if (!state.sortingResearch.firstDragStartedAtMs) {
        markFirstDragStarted();
    }

    const now = Date.now();
    const eventLog = {
        factorId,
        factorTitle: getFactorTitle(factorId),
        fromZone,
        fromZoneLabel: getSortingZoneLabel(fromZone),
        toZone,
        toZoneLabel: getSortingZoneLabel(toZone),
        fromIndex,
        toIndex,
        timestamp: new Date(now).toISOString(),
        timestampMs: now,
        elapsedMsFromStart: now - state.sortingResearch.sessionStartedAtMs
    };

    state.sortingResearch.sortingInteractionLog.push(eventLog);

    if (fromZone !== toZone) {
        state.sortingResearch.zoneChanges.push(eventLog);
    }

    state.sorting.moveCount = state.sortingResearch.sortingInteractionLog.length;
    updateSortingResearchFinalState();
    renderSortingReflection();
}

function updateSortingResearchFinalState(endMs = null) {
    const finalSortingResult = getFinalSortingResult();
    const finalZoneByFactor = {};

    Object.entries(finalSortingResult).forEach(([exportZone, factorIds]) => {
        factorIds.forEach((factorId, index) => {
            finalZoneByFactor[factorId] = {
                factorTitle: getFactorTitle(factorId),
                zone: exportZone,
                zoneLabel: getExportZoneLabel(exportZone),
                index
            };
        });
    });

    state.sortingResearch.finalSortingResult = finalSortingResult;
    state.sortingResearch.finalZoneByFactor = finalZoneByFactor;

    const derived = deriveSortingResearchMetrics(finalZoneByFactor, endMs);
    state.sortingResearch.perFactorMoveCounts = derived.perFactorMoveCounts;
    state.sortingResearch.factorStats = derived.factorStats;
    state.sortingResearch.zoneChanges = derived.zoneChanges;
    state.sortingResearch.hesitationIndicators = derived.hesitationIndicators;
    state.sortingResearch.reconsiderationMetrics = derived.reconsiderationMetrics;
    state.sortingResearch.totalSortingDurationMs = derived.totalSortingDurationMs;
}

function deriveSortingResearchMetrics(finalZoneByFactor, endMs = null) {
    const logs = state.sortingResearch.sortingInteractionLog;
    const sessionStartMs = state.sortingResearch.sessionStartedAtMs;
    const sessionEndMs = endMs || state.sortingResearch.sessionEndedAtMs || Date.now();
    const totalSortingDurationMs = sessionStartMs ? Math.max(0, sessionEndMs - sessionStartMs) : 0;
    const perFactorMoveCounts = FACTORS.reduce((counts, factor) => {
        counts[factor.id] = 0;
        return counts;
    }, {});
    const perFactorReturnCounts = FACTORS.reduce((counts, factor) => {
        counts[factor.id] = 0;
        return counts;
    }, {});
    const zoneHistoryByFactor = FACTORS.reduce((history, factor) => {
        history[factor.id] = ["pool"];
        return history;
    }, {});
    const zoneChanges = [];

    logs.forEach((event) => {
        perFactorMoveCounts[event.factorId] = (perFactorMoveCounts[event.factorId] || 0) + 1;

        if (event.fromZone !== event.toZone) {
            zoneChanges.push(event);
            const history = zoneHistoryByFactor[event.factorId] || [event.fromZone];
            const previousZones = history.slice(0, -1);

            if (previousZones.includes(event.toZone)) {
                perFactorReturnCounts[event.factorId] = (perFactorReturnCounts[event.factorId] || 0) + 1;
            }

            history.push(event.toZone);
            zoneHistoryByFactor[event.factorId] = history;
        }
    });

    const repeatedMoveFactors = Object.entries(perFactorMoveCounts)
        .filter(([, count]) => count > 1)
        .map(([factorId, count]) => ({
            factorId,
            factorTitle: getFactorTitle(factorId),
            moveCount: count
        }));

    const highestMoveCount = Math.max(0, ...Object.values(perFactorMoveCounts));
    const factorsWithHighestReconsideration = highestMoveCount > 1
        ? Object.entries(perFactorMoveCounts)
            .filter(([, count]) => count === highestMoveCount)
            .map(([factorId, count]) => ({
                factorId,
                factorTitle: getFactorTitle(factorId),
                moveCount: count
            }))
        : [];

    const longestGap = getLongestGapBetweenMoves(logs);
    const lastMinuteChanges = getLastMinuteChanges(logs, totalSortingDurationMs);
    const crossZoneMoveCount = zoneChanges.length;
    const returnMoveCount = Object.values(perFactorReturnCounts).reduce((total, count) => total + count, 0);
    const factorStats = buildFactorStats(
        perFactorMoveCounts,
        perFactorReturnCounts,
        zoneHistoryByFactor,
        finalZoneByFactor,
        logs
    );

    return {
        totalSortingDurationMs,
        perFactorMoveCounts,
        factorStats,
        zoneChanges,
        hesitationIndicators: {
            totalMoveCount: logs.length,
            crossZoneMoveCount,
            repeatedMoveFactors,
            returnMoveCount,
            longestGapBetweenMovesMs: longestGap.durationMs,
            longestGapBetweenMoves: longestGap,
            factorsWithHighestReconsideration,
            lastMinuteChanges
        },
        reconsiderationMetrics: {
            totalMoveCount: logs.length,
            crossZoneMoveCount,
            returnMoveCount,
            repeatedMoveFactors,
            perFactorReturnCounts
        }
    };
}

function buildFactorStats(perFactorMoveCounts, perFactorReturnCounts, zoneHistoryByFactor, finalZoneByFactor, logs) {
    return FACTORS.reduce((stats, factor) => {
        const factorLogs = logs.filter((event) => event.factorId === factor.id);
        const finalPlacement = finalZoneByFactor[factor.id] || {
            zone: "pool",
            zoneLabel: "Unsorted",
            index: state.sorting.pool.indexOf(factor.id)
        };
        const firstPlacedEvent = factorLogs.find((event) => event.toZone !== "pool") || null;
        const lastMovedEvent = factorLogs.length ? factorLogs[factorLogs.length - 1] : null;

        stats[factor.id] = {
            factorTitle: factor.title,
            totalMoves: perFactorMoveCounts[factor.id] || 0,
            zoneChanges: factorLogs.filter((event) => event.fromZone !== event.toZone).length,
            returnMoveCount: perFactorReturnCounts[factor.id] || 0,
            visitedZones: zoneHistoryByFactor[factor.id] || ["pool"],
            finalZone: finalPlacement.zone,
            finalZoneLabel: finalPlacement.zoneLabel,
            finalIndex: finalPlacement.index,
            firstPlacedAtMs: firstPlacedEvent ? firstPlacedEvent.elapsedMsFromStart : null,
            lastMovedAtMs: lastMovedEvent ? lastMovedEvent.elapsedMsFromStart : null
        };

        return stats;
    }, {});
}

function getLongestGapBetweenMoves(logs) {
    if (logs.length < 2) {
        return {
            durationMs: 0,
            fromFactorId: "",
            fromFactorTitle: "",
            toFactorId: "",
            toFactorTitle: ""
        };
    }

    let longestGap = {
        durationMs: 0,
        fromFactorId: "",
        fromFactorTitle: "",
        toFactorId: "",
        toFactorTitle: ""
    };

    for (let index = 1; index < logs.length; index += 1) {
        const previous = logs[index - 1];
        const current = logs[index];
        const durationMs = current.timestampMs - previous.timestampMs;

        if (durationMs > longestGap.durationMs) {
            longestGap = {
                durationMs,
                fromFactorId: previous.factorId,
                fromFactorTitle: previous.factorTitle,
                toFactorId: current.factorId,
                toFactorTitle: current.factorTitle
            };
        }
    }

    return longestGap;
}

function getLastMinuteChanges(logs, totalSortingDurationMs) {
    if (!logs.length || !state.sortingResearch.sessionStartedAtMs || totalSortingDurationMs <= 0) {
        return [];
    }

    const thresholdMs = Math.min(30000, totalSortingDurationMs * 0.25);
    const lateStartElapsedMs = Math.max(0, totalSortingDurationMs - thresholdMs);

    return logs.filter((event) => event.elapsedMsFromStart >= lateStartElapsedMs);
}

function getFinalSortingResult() {
    return {
        important: [...state.sorting.mostImportant],
        medium: [...state.sorting.medium],
        notImportant: [...state.sorting.notImportant],
        pool: [...state.sorting.pool]
    };
}

function getSortingZoneLabel(zoneKey) {
    return SORTING_ZONE_LABELS[zoneKey] || zoneKey || "Unknown";
}

function getExportZoneLabel(exportZone) {
    const exportLabels = {
        pool: "Unsorted",
        important: "Important",
        medium: "Medium",
        notImportant: "Not Important"
    };

    return exportLabels[exportZone] || exportZone;
}

function renderSortingReflection() {
    const panel = document.getElementById("sortingReflectionPanel");
    const summary = document.getElementById("sortingBehaviourSummary");

    if (!panel || !summary) {
        return;
    }

    const hasSortedCards =
        state.sorting.mostImportant.length > 0 ||
        state.sorting.medium.length > 0 ||
        state.sorting.notImportant.length > 0;

    if (!hasSortedCards && state.sortingResearch.sortingInteractionLog.length === 0) {
        panel.classList.add("hidden");
        return;
    }

    updateSortingResearchFinalState();
    panel.classList.remove("hidden");

    summary.innerHTML = getSortingReflectionStatements()
        .map((statement) => `<div class="summary-item">${escapeHtml(statement)}</div>`)
        .join("");
}

function getSortingReflectionStatements() {
    const indicators = state.sortingResearch.hesitationIndicators || {};
    const metrics = state.sortingResearch.reconsiderationMetrics || {};
    const statements = [];

    statements.push(`You made ${indicators.totalMoveCount || 0} sorting move${(indicators.totalMoveCount || 0) === 1 ? "" : "s"}.`);

    if (indicators.repeatedMoveFactors && indicators.repeatedMoveFactors.length > 0) {
        const topRepeated = indicators.repeatedMoveFactors[0];
        statements.push(`You moved ${topRepeated.factorTitle} ${topRepeated.moveCount} times.`);
    }

    if (indicators.longestGapBetweenMovesMs > 0 && indicators.longestGapBetweenMoves) {
        statements.push(`The longest gap between moves was between ${indicators.longestGapBetweenMoves.fromFactorTitle} and ${indicators.longestGapBetweenMoves.toFactorTitle}.`);
    }

    if (metrics.returnMoveCount > 0) {
        statements.push(`You returned ${metrics.returnMoveCount} factor move${metrics.returnMoveCount === 1 ? "" : "s"} to an earlier zone.`);
    }

    if (indicators.lastMinuteChanges && indicators.lastMinuteChanges.length > 1) {
        statements.push(`You made ${indicators.lastMinuteChanges.length} changes near the end of sorting.`);
    }

    statements.push(getPriorityPatternStatement());

    return statements;
}

function getPriorityPatternStatement() {
    const importantFactorTypes = state.sorting.mostImportant
        .map((factorId) => FACTORS.find((factor) => factor.id === factorId))
        .filter(Boolean)
        .map((factor) => factor.type);
    const immediateOutcomeCount = importantFactorTypes.filter((type) => type === "quantitative").length;
    const structuralBarrierCount = importantFactorTypes.filter((type) => type === "risk").length;

    if (state.sorting.mostImportant.length === 0) {
        return "Your highest-priority zone is still empty, so the priority pattern is not clear yet.";
    }

    if (immediateOutcomeCount > structuralBarrierCount) {
        return "Your final priorities focused more on immediate outcomes than structural barriers.";
    }

    if (structuralBarrierCount > immediateOutcomeCount) {
        return "Your final priorities gave stronger weight to structural barriers such as access, visa difficulty, or time to employment.";
    }

    return "Your final priorities balanced immediate outcomes with structural or personal factors.";
}

function renderCareers() {
    const careerGrid = document.getElementById("careerGrid");
    if (!careerGrid) {
        return;
    }

    careerGrid.innerHTML = "";

    getRankedCareers().forEach(({ career, score }, index) => {
        const showRecommendation = index === 0 && score > 0;
        const card = document.createElement("div");
        card.className = `career-card${state.form.initialCareerChoice === career.id ? " selected" : ""}`;
        card.innerHTML = `
            <div class="card-top">
                <div class="card-title">${career.title}</div>
                <div class="mini-badge">${career.badge}</div>
            </div>
            ${showRecommendation ? '<div class="recommendation-note">Recommended based on your background</div>' : ""}
            <div class="card-desc">${career.description}</div>
            <div class="helper-text" style="margin-top: 10px;">
                <strong>Salary:</strong> ${career.indicators.salary}<br>
                <strong>Employment:</strong> ${career.indicators.employmentRate}
            </div>
        `;

        card.addEventListener("click", () => {
            state.form.initialCareerChoice = career.id;
            renderCareers();
        });

        careerGrid.appendChild(card);
    });
}

function getRankedCareers() {
    return CAREERS
        .map((career, index) => ({
            career,
            index,
            score: getCareerRelevanceScore(career)
        }))
        .sort((a, b) => b.score - a.score || a.index - b.index);
}

function getCareerRelevanceScore(career) {
    let score = 0;
    const major = state.form.major;
    const interest = state.form.interest;
    const skill = state.form.skills;

    if (major && hasTextMatch(major, career.fitMajors || [])) {
        score += 3;
    }

    if (interest) {
        score += getMatchStrength(interest, [
            career.title,
            career.badge,
            career.description,
            ...(career.fitMajors || []),
            ...(career.skills || [])
        ]) * 2;
    }

    if (skill) {
        score += getMatchStrength(skill, career.skills || []) * 2;
    }

    return score;
}

function renderCareerDetail() {
    const detailPanel = document.getElementById("careerDetail");
    if (!detailPanel) {
        return;
    }

    const selectedCareer = CAREERS.find((career) => career.id === state.form.initialCareerChoice);

    if (!selectedCareer) {
        detailPanel.innerHTML = "<p>No career selected.</p>";
        return;
    }

    detailPanel.innerHTML = `
        <div style="font-size: 20px; font-weight: 700; margin-bottom: 12px;">${selectedCareer.title}</div>
        <div><strong>Description:</strong> ${selectedCareer.description}</div>
        <div><strong>Skills:</strong> ${selectedCareer.skills.join(", ")}</div>
        <div><strong>Salary:</strong> ${selectedCareer.indicators.salary}</div>
        <div><strong>Employment Rate:</strong> ${selectedCareer.indicators.employmentRate}</div>
        <div><strong>Visa Difficulty:</strong> ${selectedCareer.indicators.visaDifficulty}</div>
        <div><strong>Time to Employment:</strong> ${selectedCareer.indicators.timeToEmployment}</div>
        <hr style="margin: 14px 0; border: none; border-top: 1px solid #e5e7eb;">
        <div><strong>International Gap:</strong> ${selectedCareer.internationalGap.summary}</div>
        <div><strong>Salary Note:</strong> ${selectedCareer.internationalGap.salaryNote}</div>
        <div><strong>Employment Note:</strong> ${selectedCareer.internationalGap.employmentNote}</div>
        <div><strong>Reminder:</strong> ${selectedCareer.internationalGap.reminder}</div>
    `;
}

function renderSummary() {
    persistCurrentInputs();
    updateSortingResearchFinalState();

    const summaryList = document.getElementById("summaryList");
    if (!summaryList) {
        return;
    }

    const selectedCareer = getCareerById(state.form.initialCareerChoice);
    const revisedCareer = getCareerById(state.form.revisedCareerChoice);
    const mostImportantTitles = getFactorTitles(state.sorting.mostImportant);
    const mediumTitles = getFactorTitles(state.sorting.medium);
    const notImportantTitles = getFactorTitles(state.sorting.notImportant);
    const poolTitles = getFactorTitles(state.sorting.pool);
    const repeatedMoveFactors = state.sortingResearch.hesitationIndicators.repeatedMoveFactors || [];
    const reflectionResponses = state.sortingResearch.reflectionResponses;

    const items = [
        ["Major", state.form.major || "Not provided"],
        ["Interested field", state.form.interest || "Not provided"],
        ["Skills", state.form.skills || "Not provided"],
        ["Expected salary", state.form.expectedSalary || "Not provided"],
        ["Job ease expectation", state.form.expectedJobEase || "Not provided"],
        ["International student difficulty", state.form.expectedDifficulty || "Not provided"],
        ["Important factors", formatList(mostImportantTitles, "None")],
        ["Medium factors", formatList(mediumTitles, "None")],
        ["Ignored factors", formatList(notImportantTitles, "None")],
        ["Still unsorted", formatList(poolTitles, "None")],
        ["Sorting moves", String(state.sortingResearch.hesitationIndicators.totalMoveCount || 0)],
        ["Repeatedly moved factors", formatRepeatedMoveFactors(repeatedMoveFactors)],
        ["Hardest factor to rank", reflectionResponses.hardestFactorToRank ? getFactorTitle(reflectionResponses.hardestFactorToRank) : "Not provided"],
        ["Sorting uncertainty", reflectionResponses.feltUncertain || "Not provided"],
        ["Initial career choice", selectedCareer ? selectedCareer.title : "Not selected"],
        ["Confidence before reveal", state.form.confidenceBefore || "Not provided"],
        ["Changed decision after reveal", state.form.changedDecision || "Not provided"],
        ["Revised career choice", state.form.changedDecision === "Yes" && revisedCareer ? revisedCareer.title : "No revised choice"],
        ["Most influential information", state.form.mostInfluentialFactor || "Not provided"],
        ["Salary expectation gap", getSalaryExpectationGap(selectedCareer)],
        ["Short reason", state.form.changeReason || "Not provided"]
    ];

    summaryList.innerHTML = items
        .map((item) => `<div class="summary-item"><strong>${escapeHtml(item[0])}:</strong> ${escapeHtml(item[1])}</div>`)
        .join("");
}

function renderIgnoredInsights() {
    const insightResult = document.getElementById("insightResult");
    if (!insightResult) {
        return;
    }

    const ignoredTitles = getFactorTitles(state.sorting.notImportant);

    if (ignoredTitles.length === 0) {
        insightResult.innerHTML = '<div class="summary-item"><strong>No factors were marked as ignored.</strong></div>';
        return;
    }

    insightResult.innerHTML = `
        <div class="summary-item">
            <strong>You tended to overlook:</strong> ${escapeHtml(ignoredTitles.join(", "))}
        </div>
        <div class="summary-item">
            <strong>Research note:</strong> These are the factors placed in the <em>Not Important</em> area during card sorting.
        </div>
    `;
}

function getCareerById(careerId) {
    return CAREERS.find((career) => career.id === careerId);
}

function getFactorTitles(factorIds) {
    return factorIds.map((id) => getFactorTitle(id));
}

function getFactorTitle(factorId) {
    const factor = FACTORS.find((item) => item.id === factorId);
    return factor ? factor.title : factorId;
}

function getFactorExportItem(factorId) {
    const factor = FACTORS.find((item) => item.id === factorId);

    if (!factor) {
        return { id: factorId, title: factorId };
    }

    return {
        id: factor.id,
        title: factor.title,
        type: factor.type
    };
}

function formatList(items, fallback) {
    return items.length > 0 ? items.join(", ") : fallback;
}

function formatRepeatedMoveFactors(repeatedMoveFactors) {
    if (!repeatedMoveFactors.length) {
        return "None";
    }

    return repeatedMoveFactors
        .map((factor) => `${factor.factorTitle} (${factor.moveCount})`)
        .join(", ");
}

function normalizeText(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function getTextTokens(value) {
    return normalizeText(value)
        .split(" ")
        .filter((token) => token.length > 2);
}

function hasTextMatch(value, targets) {
    return getMatchStrength(value, targets) > 0;
}

function getMatchStrength(value, targets) {
    const normalizedValue = normalizeText(value);
    if (!normalizedValue) {
        return 0;
    }

    const valueTokens = getTextTokens(value);

    for (const target of targets) {
        const normalizedTarget = normalizeText(target);
        if (!normalizedTarget) {
            continue;
        }

        if (normalizedTarget.includes(normalizedValue) || normalizedValue.includes(normalizedTarget)) {
            return 1;
        }

        const targetTokens = getTextTokens(target);
        if (valueTokens.some((token) => targetTokens.includes(token))) {
            return 0.5;
        }
    }

    return 0;
}

function getSalaryExpectationGap(career) {
    const expectedSalary = parseCurrencyNumber(state.form.expectedSalary);
    const displayedSalary = career ? parseCurrencyNumber(career.indicators.salary) : null;

    if (!expectedSalary || !displayedSalary) {
        return "Not enough salary information to infer a gap.";
    }

    const difference = expectedSalary - displayedSalary;
    const absoluteDifference = Math.abs(difference);

    if (absoluteDifference <= 1000) {
        return `Your expectation was close to the displayed starting salary of ${formatCurrency(displayedSalary)}.`;
    }

    const direction = difference > 0 ? "above" : "below";
    return `Your expectation (${formatCurrency(expectedSalary)}) was ${formatCurrency(absoluteDifference)} ${direction} the displayed starting salary (${formatCurrency(displayedSalary)}).`;
}

function parseCurrencyNumber(value) {
    const match = String(value || "").replace(/,/g, "").match(/\d+(\.\d+)?/);
    return match ? Number(match[0]) : null;
}

function formatCurrency(value) {
    return `$${Math.round(value).toLocaleString("en-AU")}`;
}

function getTimePerStepSnapshot() {
    const snapshot = { ...state.meta.timePerStep };
    const stepKey = String(state.currentStep);
    snapshot[stepKey] = (snapshot[stepKey] || 0) + Math.max(0, Date.now() - state.meta.stepEnteredAt);
    return snapshot;
}

function cloneCareerForExport(career) {
    if (!career) {
        return null;
    }

    return {
        id: career.id,
        title: career.title,
        badge: career.badge,
        description: career.description,
        skills: [...(career.skills || [])],
        fitMajors: [...(career.fitMajors || [])],
        indicators: { ...(career.indicators || {}) },
        internationalGap: { ...(career.internationalGap || {}) },
        community: career.community || ""
    };
}

function cloneSortingResearchForExport() {
    return {
        sessionStartedAt: state.sortingResearch.sessionStartedAt,
        firstDragStartedAt: state.sortingResearch.firstDragStartedAt,
        sessionEndedAt: state.sortingResearch.sessionEndedAt,
        totalSortingDurationMs: state.sortingResearch.totalSortingDurationMs,
        completed: state.sortingResearch.completed,
        sortingInteractionLog: state.sortingResearch.sortingInteractionLog.map((event) => ({
            factorId: event.factorId,
            fromZone: event.fromZone,
            toZone: event.toZone,
            fromIndex: event.fromIndex,
            toIndex: event.toIndex,
            timestamp: event.timestamp,
            elapsedMsFromStart: event.elapsedMsFromStart
        })),
        factorStats: JSON.parse(JSON.stringify(state.sortingResearch.factorStats)),
        finalSortingResult: JSON.parse(JSON.stringify(state.sortingResearch.finalSortingResult)),
        hesitationIndicators: JSON.parse(JSON.stringify(state.sortingResearch.hesitationIndicators)),
        reflectionResponses: { ...state.sortingResearch.reflectionResponses }
    };
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function buildExportData() {
    persistCurrentInputs();
    updateSortingResearchFinalState();

    const selectedCareer = getCareerById(state.form.initialCareerChoice);
    const revisedCareer = state.form.revisedCareerChoice ? getCareerById(state.form.revisedCareerChoice) : null;
    const exportedAt = new Date();

    return {
        form: { ...state.form },
        sorting: {
            pool: state.sorting.pool.map((id) => getFactorExportItem(id)),
            important: state.sorting.mostImportant.map((id) => getFactorExportItem(id)),
            medium: state.sorting.medium.map((id) => getFactorExportItem(id)),
            ignored: state.sorting.notImportant.map((id) => getFactorExportItem(id)),
            moveCount: state.sorting.moveCount
        },
        sortingResearch: cloneSortingResearchForExport(),
        selectedCareer: cloneCareerForExport(selectedCareer),
        revisedCareer: cloneCareerForExport(revisedCareer),
        meta: {
            prototype: "Career Decision Prototype",
            startedAt: state.meta.startedAt,
            exportedAt: exportedAt.toISOString(),
            totalDurationMs: exportedAt.getTime() - state.meta.startedAtMs,
            timePerStep: getTimePerStepSnapshot()
        }
    };
}

function downloadData() {
    const exportData = buildExportData();
    const json = JSON.stringify(exportData, null, 4);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "career_decision_data.json";
    link.click();
    URL.revokeObjectURL(url);
}
