/* Definitions transcribed from the final submitted manuscript. Sources are recorded in downloads/provenance.json. */
window.LLM4MDE_DEFINITIONS = {
  "paperTypes": [
    {
      "name": "Proposed method",
      "definition": "Contribute a concrete method, framework, pipeline, or technique for applying LLMs to MDE tasks"
    },
    {
      "name": "Benchmarking and evaluation",
      "definition": "Assess, compare, or benchmark LLMs, prompting strategies, enhancement techniques, or existing LLM-based methods for MDE tasks"
    },
    {
      "name": "New idea or vision",
      "definition": "Contribute a new idea, conceptual framework, vision, position, or reflection on using LLMs in MDE, possibly with preliminary results"
    },
    {
      "name": "Tool demo",
      "definition": "Present or demonstrate a tool, prototype, or reusable software artifact that uses LLMs for MDE tasks"
    }
  ],
  "applicationDomains": [
    {
      "name": "Transportation Systems",
      "definition": "Systems concerned with transportation, mobility, and vehicle operation, including automotive, driver-assistance, train control, and autonomous driving systems.",
      "sourceValues": [
        "ADS",
        "Train Autonomous Control System",
        "Advanced Driver Assistance Systems (ADASs)"
      ]
    },
    {
      "name": "Aerospace Systems",
      "definition": "Systems used in aviation, spacecraft, and broader aerospace contexts where modeling supports design, operation, analysis, or assurance of aerospace artifacts.",
      "sourceValues": [
        "Spacecraft",
        "Aircraft",
        "Aerospace"
      ]
    },
    {
      "name": "Computing and Digital Systems",
      "definition": "Software-intensive and cyber-physical digital systems, including cloud, embedded, networked, IoT, CPS, digital twin, robotic, adaptive, and smart-device systems.",
      "sourceValues": [
        "Network",
        "Smart TVs",
        "Robotic Process Automation",
        "CPS",
        "Enterprise Digital Twins",
        "Embedded system",
        "Cloud computing",
        "Collective adaptive systems",
        "IoT",
        "Robotic"
      ]
    },
    {
      "name": "Energy and Power Systems",
      "definition": "Systems related to energy production, delivery, monitoring, or operation, including electric power industry applications.",
      "sourceValues": [
        "Electric Power Industry"
      ]
    },
    {
      "name": "Business and Enterprise Systems",
      "definition": "Systems that support business processes, organizational operations, enterprise workflows, or enterprise-level digital transformation.",
      "sourceValues": []
    },
    {
      "name": "Governance and Public Systems",
      "definition": "Systems used for public administration, governance, emergency response, crisis management, or services operated in public-sector contexts.",
      "sourceValues": [
        "Crisis management",
        "Public administration"
      ]
    },
    {
      "name": "Education Systems",
      "definition": "Systems and applications used in educational settings, including learning, teaching, training, and educational support scenarios.",
      "sourceValues": [
        "Education"
      ]
    },
    {
      "name": "Healthcare Systems",
      "definition": "Systems and applications used in healthcare contexts, including clinical, medical, patient-care, and health-service scenarios.",
      "sourceValues": [
        "Healthcare"
      ]
    },
    {
      "name": "General Systems",
      "definition": "General-purpose or domain-agnostic systems where no specific application domain is identified.",
      "sourceValues": [
        "General"
      ]
    }
  ]
};
// Match the dataset's specific domain labels to the manuscript's broader categories.
window.LLM4MDE_DATA.studies.forEach(study => {
  const domain = study.raw['RQ7 ApplicationDomain'].trim().toLocaleLowerCase();
  study.facets.domains = window.LLM4MDE_DEFINITIONS.applicationDomains
    .filter(category => category.sourceValues.some(value => value.toLocaleLowerCase() === domain))
    .map(category => category.name);
});
