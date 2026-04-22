const FACTORS = [
    {
        id: "salary",
        title: "Salary",
        description: "Expected income after graduation.",
        detail: "This reflects the typical starting salary for graduates in this field. However, averages may not reflect international student outcomes.",
        type: "quantitative"
    },

    {
        id: "employment_rate",
        title: "Employment Rate",
        description: "How many graduates find jobs in this field.",
        detail: "High employment rates may not account for delayed employment or part-time roles, especially for international students.",
        type: "quantitative"
    },

    {
        id: "visa_difficulty",
        title: "Visa Difficulty",
        description: "How hard it is for international students to get jobs in this field.",
        detail: "Some industries have stricter visa requirements or prefer domestic candidates, which can affect job access.",
        type: "risk"
    },

    {
        id: "time_to_employment",
        title: "Time to Employment",
        description: "How long it usually takes to get a job after graduation.",
        detail: "Some roles may take months longer to secure, especially without local experience.",
        type: "risk"
    },

    {
        id: "interest",
        title: "Interest Match",
        description: "How much you enjoy or feel interested in the field.",
        detail: "Interest is important for long-term motivation but may conflict with financial or visa constraints.",
        type: "personal"
    },

    {
        id: "work_life_balance",
        title: "Work-life Balance",
        description: "How manageable the job is in terms of stress and lifestyle.",
        detail: "Some high-paying roles may involve long hours or high pressure.",
        type: "personal"
    }
];