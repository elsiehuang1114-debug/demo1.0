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
        changedDecision: "No"
    },
    sorting: {
        pool: [],
        mostImportant: [],
        medium: [],
        notImportant: []
    }
};

document.addEventListener("DOMContentLoaded", () => {
    initialiseState();
    renderFactorCards();
    setupDropZones();
    renderCareers();
    updateStepVisibility();
});

function initialiseState() {
    state.sorting.pool = FACTORS.map((factor) => factor.id);
}

function goToStep(stepNumber) {
    persistCurrentInputs();

    if (!validateBeforeStepChange(stepNumber)) {
        return;
    }

    state.currentStep = stepNumber;

    if (stepNumber === 4) {
        renderCareers();
    }

    if (stepNumber === 5) {
        renderCareerDetail();
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

    if (showEmptyHint && factorIds.length === 0) {
        const empty = document.createElement("div");
        empty.className = "drop-hint";
        empty.textContent = "Drop cards here";
        container.appendChild(empty);
        return;
    }

    factorIds.forEach((factorId) => {
        const factor = FACTORS.find((item) => item.id === factorId);
        if (!factor) {
            return;
        }

        const card = document.createElement("div");
        card.className = "factor-card draggable-card";
        card.draggable = true;
        card.dataset.factorId = factor.id;
        card.innerHTML = `
            <div class="card-top">
                <div class="card-title">${factor.title}</div>
                <div class="mini-badge">${factor.type}</div>
            </div>
            <div class="card-desc">${factor.description}</div>
        `;

        card.addEventListener("dragstart", handleDragStart);
        container.appendChild(card);
    });
}

function setupDropZones() {
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
    event.dataTransfer.setData("text/plain", event.target.dataset.factorId);
}

function handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove("drag-over");

    const factorId = event.dataTransfer.getData("text/plain");
    const targetId = event.currentTarget.id;

    moveFactorToZone(factorId, targetId);
    renderFactorCards();
}

function moveFactorToZone(factorId, targetId) {
    removeFactorFromAllZones(factorId);

    if (targetId === "factorPool") {
        state.sorting.pool.push(factorId);
        return;
    }
    if (targetId === "mostImportantZone") {
        state.sorting.mostImportant.push(factorId);
        return;
    }
    if (targetId === "mediumZone") {
        state.sorting.medium.push(factorId);
        return;
    }
    if (targetId === "notImportantZone") {
        state.sorting.notImportant.push(factorId);
    }
}

function removeFactorFromAllZones(factorId) {
    Object.keys(state.sorting).forEach((key) => {
        state.sorting[key] = state.sorting[key].filter((id) => id !== factorId);
    });
}

function renderCareers() {
    const careerGrid = document.getElementById("careerGrid");
    if (!careerGrid) {
        return;
    }

    careerGrid.innerHTML = "";

    CAREERS.forEach((career) => {
        const card = document.createElement("div");
        card.className = `career-card${state.form.initialCareerChoice === career.id ? " selected" : ""}`;
        card.innerHTML = `
            <div class="card-top">
                <div class="card-title">${career.title}</div>
                <div class="mini-badge">${career.badge}</div>
            </div>
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

    const summaryList = document.getElementById("summaryList");
    if (!summaryList) {
        return;
    }

    const selectedCareer = CAREERS.find((career) => career.id === state.form.initialCareerChoice);
    const mostImportantTitles = state.sorting.mostImportant.map((id) => getFactorTitle(id)).join(", ");
    const mediumTitles = state.sorting.medium.map((id) => getFactorTitle(id)).join(", ");
    const notImportantTitles = state.sorting.notImportant.map((id) => getFactorTitle(id)).join(", ");

    const items = [
        ["Major", state.form.major || "Not provided"],
        ["Interested field", state.form.interest || "Not provided"],
        ["Skills", state.form.skills || "Not provided"],
        ["Expected salary", state.form.expectedSalary || "Not provided"],
        ["Job ease expectation", state.form.expectedJobEase || "Not provided"],
        ["International student difficulty", state.form.expectedDifficulty || "Not provided"],
        ["Important factors", mostImportantTitles || "None"],
        ["Medium factors", mediumTitles || "None"],
        ["Ignored factors", notImportantTitles || "None"],
        ["Initial career choice", selectedCareer ? selectedCareer.title : "Not selected"],
        ["Changed decision after reveal", state.form.changedDecision || "Not provided"]
    ];

    summaryList.innerHTML = items
        .map((item) => `<div class="summary-item"><strong>${item[0]}:</strong> ${item[1]}</div>`)
        .join("");
}

function renderIgnoredInsights() {
    const insightResult = document.getElementById("insightResult");
    if (!insightResult) {
        return;
    }

    const ignoredTitles = state.sorting.notImportant.map((id) => getFactorTitle(id));

    if (ignoredTitles.length === 0) {
        insightResult.innerHTML = '<div class="summary-item"><strong>No factors were marked as ignored.</strong></div>';
        return;
    }

    insightResult.innerHTML = `
        <div class="summary-item">
            <strong>You tended to overlook:</strong> ${ignoredTitles.join(", ")}
        </div>
        <div class="summary-item">
            <strong>Research note:</strong> These are the factors placed in the <em>Not Important</em> area during card sorting.
        </div>
    `;
}

function getFactorTitle(factorId) {
    const factor = FACTORS.find((item) => item.id === factorId);
    return factor ? factor.title : factorId;
}

function buildExportData() {
    const selectedCareer = CAREERS.find((career) => career.id === state.form.initialCareerChoice);

    return {
        form: state.form,
        sorting: {
            important: state.sorting.mostImportant.map((id) => getFactorTitle(id)),
            medium: state.sorting.medium.map((id) => getFactorTitle(id)),
            ignored: state.sorting.notImportant.map((id) => getFactorTitle(id))
        },
        selectedCareer: selectedCareer
            ? {
                id: selectedCareer.id,
                title: selectedCareer.title,
                badge: selectedCareer.badge,
                indicators: selectedCareer.indicators,
                internationalGap: selectedCareer.internationalGap
            }
            : null,
        meta: {
            prototype: "Career Decision Prototype",
            exportedAt: new Date().toISOString()
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
