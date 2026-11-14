
/**
 * Prept AI Buddy
 * lib/interviewCatalog.js
 */

export const QUESTION_TYPES = {
  CONCEPTUAL: "Theoretical",
  CODING: "Coding",
  SCENARIO: "Scenario Based",
  MCQ: "Multiple Choice",
  COMPLEXITY: "Time & Space Complexity",
  DEBUGGING: "Debugging",
  DESIGN: "System / Low-Level Design",
  SQL_QUERY: "SQL Query Writing",
  PRACTICAL: "Practical / Hands-on",
  BEHAVIORAL: "Behavioral",
};

export const INTERVIEW_CATALOG = {
  CORE_CS: {
    label: "Core CS",
    topics: [
      "DBMS",
      "SQL",
      "Operating Systems",
      "Computer Networks",
      "OOP",
      "Transactions",
      "Concurrency",
      "Indexing",
      "Memory Management",
      "Process Scheduling",
    ],
    types: [
      "CONCEPTUAL",
      "SCENARIO",
      "MCQ",
      "SQL_QUERY",
      "DEBUGGING",
    ],
  },

  DSA: {
    label: "DSA",
    topics: [
      "Arrays",
      "Strings",
      "Hash Maps",
      "Two Pointers",
      "Sliding Window",
      "Binary Search",
      "Linked Lists",
      "Stacks & Queues",
      "Trees",
      "Graphs",
      "Heaps",
      "Greedy",
      "Recursion",
      "Backtracking",
      "Dynamic Programming",
      "Time & Space Complexity",
    ],
    types: [
      "CODING",
      "CONCEPTUAL",
      "SCENARIO",
      "MCQ",
      "COMPLEXITY",
      "DEBUGGING",
    ],
  },

  FRONTEND: {
    label: "Frontend",
    topics: [
      "HTML",
      "CSS",
      "JavaScript",
      "TypeScript",
      "React",
      "React Hooks",
      "Next.js",
      "Accessibility",
      "Browser APIs",
      "Frontend Performance",
      "State Management",
    ],
    types: [
      "CONCEPTUAL",
      "CODING",
      "SCENARIO",
      "MCQ",
      "DEBUGGING",
      "PRACTICAL",
    ],
  },

  BACKEND: {
    label: "Backend",
    topics: [
      "Node.js",
      "Express.js",
      "REST APIs",
      "GraphQL",
      "SQL",
      "PostgreSQL",
      "MongoDB",
      "Authentication",
      "Authorization",
      "Caching",
      "Concurrency",
      "Backend Security",
    ],
    types: [
      "CONCEPTUAL",
      "CODING",
      "SCENARIO",
      "MCQ",
      "DEBUGGING",
      "DESIGN",
      "SQL_QUERY",
    ],
  },

  FULLSTACK: {
    label: "Full Stack",
    topics: [
      "MERN Stack",
      "HTML",
      "CSS",
      "JavaScript",
      "React",
      "Next.js",
      "Node.js",
      "Express.js",
      "MongoDB",
      "PostgreSQL",
      "API Integration",
      "Authentication",
      "Deployment",
      "Full Stack Architecture",
    ],
    types: [
      "CONCEPTUAL",
      "CODING",
      "SCENARIO",
      "MCQ",
      "DEBUGGING",
      "DESIGN",
      "PRACTICAL",
    ],
  },

  SYSTEM_DESIGN: {
    label: "System Design",
    topics: [
      "HLD",
      "LLD",
      "Scalability",
      "Load Balancing",
      "Caching",
      "Database Sharding",
      "Replication",
      "Microservices",
      "Distributed Systems",
      "Message Queues",
      "Rate Limiting",
      "Consistent Hashing",
      "Real-time Systems",
      "CAP Theorem",
    ],
    types: [
      "DESIGN",
      "SCENARIO",
      "CONCEPTUAL",
      "MCQ",
      "PRACTICAL",
    ],
  },

  MACHINE_CODING: {
    label: "Machine Coding",
    topics: [
      "Object-Oriented Design",
      "SOLID Principles",
      "Design Patterns",
      "LRU Cache",
      "Rate Limiter",
      "Parking Lot",
      "Task Management",
      "Concurrency",
      "API Implementation",
      "Testing",
    ],
    types: [
      "CODING",
      "DESIGN",
      "SCENARIO",
      "DEBUGGING",
      "PRACTICAL",
    ],
  },

  AI_ML: {
    label: "AI & ML",
    topics: [
      "ML Fundamentals",
      "Deep Learning",
      "Neural Networks",
      "Transformers",
      "LLMs",
      "Prompt Engineering",
      "RAG",
      "Embeddings",
      "Vector Databases",
      "MCP",
      "AI Agents",
      "Tool Calling",
      "Fine-tuning",
      "Tokenization",
      "Model Evaluation",
      "Hallucinations",
      "Prompt Injection",
      "Multimodal AI",
      "AI Engineering Trends",
    ],
    types: [
      "CONCEPTUAL",
      "SCENARIO",
      "MCQ",
      "CODING",
      "DESIGN",
      "PRACTICAL",
    ],
  },

  DEVOPS: {
    label: "DevOps",
    topics: [
      "Docker",
      "Kubernetes",
      "CI/CD",
      "AWS",
      "Cloud Computing",
      "Linux",
      "Networking",
      "Infrastructure as Code",
      "Terraform",
      "Monitoring",
      "Logging",
      "Observability",
      "Deployment Strategies",
    ],
    types: [
      "CONCEPTUAL",
      "SCENARIO",
      "MCQ",
      "DEBUGGING",
      "PRACTICAL",
      "DESIGN",
    ],
  },

  MOBILE: {
    label: "Mobile",
    topics: [
      "React Native",
      "Android",
      "iOS",
      "Mobile Performance",
      "Offline Storage",
      "App Lifecycle",
      "Notifications",
      "Mobile Security",
    ],
    types: [
      "CONCEPTUAL",
      "CODING",
      "SCENARIO",
      "MCQ",
      "DEBUGGING",
    ],
  },

  BEHAVIORAL: {
    label: "Behavioral",
    topics: [
      "Teamwork",
      "Leadership",
      "Communication",
      "Conflict Resolution",
      "Problem Solving",
      "Ownership",
      "Career Growth",
      "STAR Method",
    ],
    types: [
      "BEHAVIORAL",
      "SCENARIO",
    ],
  },
};

export const SUBJECT_OPTIONS = Object.entries(
  INTERVIEW_CATALOG
).map(([value, item]) => ({
  value,
  label: item.label,
}));

export const DIFFICULTY_OPTIONS = [
  { value: "MIXED", label: "Mixed" },
  { value: "EASY", label: "Easy" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HARD", label: "Hard" },
];

export const WEB_OPTIONS = [
  { value: "AUTO", label: "Auto" },
  { value: "OFF", label: "Off" },
  { value: "ON", label: "On" },
];

export function getTopicOptions(subject) {
  const topics = INTERVIEW_CATALOG[subject]?.topics || [];

  return [
    { value: "ALL", label: "All topics" },
    ...topics.map((topic) => ({
      value: topic,
      label: topic,
    })),
  ];
}

export function getQuestionTypeOptions(subject) {
  const types = INTERVIEW_CATALOG[subject]?.types || [];

  return [
    { value: "ANY", label: "Any type" },
    ...types.map((type) => ({
      value: type,
      label: QUESTION_TYPES[type],
    })),
  ];
}

export function makeDefaultPreferences(subject = "DSA") {
  return {
    mode: "FREE_FLOW",
    subject: INTERVIEW_CATALOG[subject] ? subject : "DSA",
    topic: "ALL",
    questionType: "ANY",
    difficulty: "MIXED",
    questionCount: 5,
    webResearch: "AUTO",
  };
}
