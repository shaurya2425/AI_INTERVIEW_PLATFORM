
/**
 * Prept AI Copilot — Curated Question Bank
 * Location: lib/questionBank.js
 *
 * 44 questions | 11 categories
 * Gemini uses this bank for intelligent question selection.
 */

const questions = [
  // ================= FRONTEND =================
  {
    category: "FRONTEND",
    topic: "React Hooks",
    difficulty: "EASY",
    question: "What is the purpose of useEffect in React?",
    answer:
      "useEffect synchronizes a React component with external systems, including subscriptions, browser APIs, and network connections. Effects run after React commits the render and can return cleanup functions.",
    followUp:
      "What happens if a dependency is missing from the useEffect dependency array?",
  },
  {
    category: "FRONTEND",
    topic: "React Performance",
    difficulty: "MEDIUM",
    question: "What is the difference between useMemo and useCallback?",
    answer:
      "useMemo caches the result of a calculation, while useCallback caches a function reference. Both can avoid unnecessary recalculations or changes in reference identity when dependencies remain unchanged.",
    followUp:
      "When is memoization unnecessary or counterproductive?",
  },
  {
    category: "FRONTEND",
    topic: "JavaScript",
    difficulty: "MEDIUM",
    question: "Explain closures in JavaScript and give a practical use case.",
    answer:
      "A closure is a function that retains access to variables from the lexical environment where it was created. Closures are useful for encapsulation, callbacks, and maintaining private state.",
    followUp:
      "How can closures cause stale state issues in React?",
  },
  {
    category: "FRONTEND",
    topic: "Browser Performance",
    difficulty: "HARD",
    question: "How would you optimize a React application that renders thousands of list items?",
    answer:
      "Use virtualization, stable keys, efficient state placement, and selective memoization where measurements justify it. Profile rendering and JavaScript execution to identify bottlenecks before optimizing.",
    followUp:
      "How would you distinguish expensive React rendering from slow browser layout?",
  },

  // ================= BACKEND =================
  {
    category: "BACKEND",
    topic: "Node.js",
    difficulty: "EASY",
    question: "Explain the Node.js event loop.",
    answer:
      "The event loop coordinates execution of asynchronous callbacks. Node.js delegates many I/O operations to operating-system facilities or its worker pool and executes callbacks when their results become ready.",
    followUp:
      "What happens when CPU-intensive JavaScript blocks the event loop?",
  },
  {
    category: "BACKEND",
    topic: "REST APIs",
    difficulty: "MEDIUM",
    question: "What is the difference between PUT and PATCH in HTTP APIs?",
    answer:
      "PUT requests generally create or replace the state of a resource, while PATCH applies a partial modification. PUT is defined as idempotent; PATCH is not necessarily idempotent.",
    followUp:
      "How can an API safely handle repeated update requests?",
  },
  {
    category: "BACKEND",
    topic: "Authentication",
    difficulty: "MEDIUM",
    question: "How does JWT-based authentication work?",
    answer:
      "After authenticating a user, a service may issue a signed JWT containing claims. Receiving services validate the signature and relevant claims such as expiration, issuer, and audience before trusting it.",
    followUp:
      "What security considerations affect where tokens are stored?",
  },
  {
    category: "BACKEND",
    topic: "Database Concurrency",
    difficulty: "HARD",
    question: "How would you prevent two users from booking the same interview slot simultaneously?",
    answer:
      "Use appropriate database constraints and an atomic transaction or conditional write to prevent conflicting bookings. Handle concurrency conflicts explicitly rather than relying on an earlier availability check.",
    followUp:
      "Why can checking availability before inserting a booking introduce a race condition?",
  },

  // ================= FULL STACK =================
  {
    category: "FULLSTACK",
    topic: "Client-Server Architecture",
    difficulty: "EASY",
    question: "How does a frontend communicate with a backend service?",
    answer:
      "A frontend commonly sends HTTP requests to backend endpoints or uses real-time protocols such as WebSockets. The backend validates and authorizes requests, performs application logic, and returns responses.",
    followUp:
      "When would WebSockets be more suitable than ordinary HTTP requests?",
  },
  {
    category: "FULLSTACK",
    topic: "Next.js",
    difficulty: "MEDIUM",
    question: "What is the difference between Server Components and Client Components in Next.js?",
    answer:
      "Server Components execute in the server rendering environment and can access server resources without exposing their implementation to the browser. Client Components provide browser-side interactivity, state hooks, and event handlers.",
    followUp:
      "How would you decide which components require the use client directive?",
  },
  {
    category: "FULLSTACK",
    topic: "State Management",
    difficulty: "MEDIUM",
    question: "How would you keep frontend state consistent with changes made on the server?",
    answer:
      "Use fetching, cache invalidation, and reconciliation following mutations. Optimistic updates can make interfaces responsive, but they need rollback or conflict-handling strategies when server operations fail.",
    followUp:
      "How would you manage two clients modifying the same record concurrently?",
  },
  {
    category: "FULLSTACK",
    topic: "Transaction Design",
    difficulty: "HARD",
    question: "How would you implement a secure credit-based interview booking workflow?",
    answer:
      "Authenticate and authorize the operation, calculate costs on the server, and perform credit deduction and booking creation within an atomic database transaction. Record an auditable credit transaction and guard against duplicate requests.",
    followUp:
      "How would you implement idempotency for booking retries?",
  },

  // ================= DSA =================
  {
    category: "DSA",
    topic: "Hash Maps",
    difficulty: "EASY",
    question: "Given an array of integers and a target, return two distinct indices whose values add up to the target.",
    answer:
      "Use a hash map to store previously visited numbers and their indices. For each number, check whether the complement exists. This gives expected O(n) time and O(n) extra space.",
    followUp:
      "How would the approach change if the input array were sorted?",
  },
  {
    category: "DSA",
    topic: "Sliding Window",
    difficulty: "MEDIUM",
    question: "Find the length of the longest substring without repeating characters.",
    answer:
      "Maintain a sliding window with the most recent index of each character. When a duplicate appears inside the window, advance its left boundary. The solution runs in expected O(n) time.",
    followUp:
      "How would you modify the solution to allow at most K distinct characters?",
  },
  {
    category: "DSA",
    topic: "Binary Trees",
    difficulty: "MEDIUM",
    question: "Find the lowest common ancestor of two nodes in a binary tree.",
    answer:
      "Recursively inspect both subtrees. If one target is found in each subtree, the current node is their lowest common ancestor. Otherwise, propagate the matching descendant upward. Handle missing nodes if the problem does not guarantee their existence.",
    followUp:
      "How does the solution become simpler for a binary search tree?",
  },
  {
    category: "DSA",
    topic: "Dynamic Programming",
    difficulty: "HARD",
    question: "Given coin denominations and a target amount, find the minimum number of coins needed to reach the amount.",
    answer:
      "Define dp[x] as the minimum coins needed to create amount x and initialize dp[0] to zero. For each amount, consider all valid denominations. The bottom-up solution takes O(amount × number of denominations) time.",
    followUp:
      "Why does choosing the largest available coin greedily fail for some denominations?",
  },

  // ================= SYSTEM DESIGN =================
  {
    category: "SYSTEM_DESIGN",
    topic: "URL Shortener",
    difficulty: "EASY",
    question: "Design a basic URL shortening service.",
    answer:
      "Build endpoints to create short links and redirect visitors. Store a unique short identifier mapped to each destination URL. Consider collision handling, expiration, indexes, and abuse protection.",
    followUp:
      "How would you generate collision-resistant short identifiers across servers?",
  },
  {
    category: "SYSTEM_DESIGN",
    topic: "Caching",
    difficulty: "MEDIUM",
    question: "How would you design a caching strategy for a high-traffic application?",
    answer:
      "Identify frequently requested data, then choose suitable cache patterns such as cache-aside or write-through. Define expiration and invalidation policies, and monitor hit rates and consistency trade-offs.",
    followUp:
      "What is a cache stampede, and how would you prevent it?",
  },
  {
    category: "SYSTEM_DESIGN",
    topic: "Scalability",
    difficulty: "MEDIUM",
    question: "Compare horizontal scaling and vertical scaling.",
    answer:
      "Vertical scaling adds resources to one machine, while horizontal scaling adds more machines or instances. Horizontal scaling often provides greater aggregate capacity but introduces distributed coordination and consistency challenges.",
    followUp:
      "How would you manage session state across multiple application instances?",
  },
  {
    category: "SYSTEM_DESIGN",
    topic: "Distributed Messaging",
    difficulty: "HARD",
    question: "Design a real-time chat system supporting millions of concurrent users.",
    answer:
      "Use scalable connection servers, message-routing infrastructure, durable message storage, and presence services. Address message ordering, delivery guarantees, reconnects, offline delivery, and backpressure.",
    followUp:
      "How would you maintain ordering of messages within each conversation?",
  },

  // ================= DEVOPS =================
  {
    category: "DEVOPS",
    topic: "Docker",
    difficulty: "EASY",
    question: "What is the difference between a Docker image and a Docker container?",
    answer:
      "A Docker image packages an application's filesystem and configuration. A container is an instance created from an image with its own runtime environment.",
    followUp:
      "Why do developers use multi-stage Docker builds?",
  },
  {
    category: "DEVOPS",
    topic: "CI/CD",
    difficulty: "MEDIUM",
    question: "Design a CI/CD pipeline for a Next.js application.",
    answer:
      "A typical pipeline installs dependencies, checks code quality, runs tests, performs security checks, builds the application, and deploys it. Include environment management, health checks, and rollback procedures.",
    followUp:
      "How would you implement zero-downtime deployments?",
  },
  {
    category: "DEVOPS",
    topic: "Kubernetes",
    difficulty: "MEDIUM",
    question: "What is the difference between a Kubernetes Deployment and a StatefulSet?",
    answer:
      "Deployments manage interchangeable replicas of application workloads, whereas StatefulSets give pods stable identities and ordered lifecycle behavior useful for certain stateful applications.",
    followUp:
      "Why might databases require stable pod identities and persistent volumes?",
  },
  {
    category: "DEVOPS",
    topic: "Observability",
    difficulty: "HARD",
    question: "How would you investigate intermittent latency spikes in a distributed application?",
    answer:
      "Correlate traces, logs, metrics, and infrastructure telemetry to identify where latency increases. Investigate dependency response times, resource saturation, queue depth, and recent changes.",
    followUp:
      "How would you distinguish database lock contention from network latency?",
  },

  // ================= AI & MACHINE LEARNING =================
  {
    category: "AI_ML",
    topic: "Learning Paradigms",
    difficulty: "EASY",
    question: "What is the difference between supervised and unsupervised learning?",
    answer:
      "Supervised learning trains on labeled examples to predict target outputs. Unsupervised learning discovers structures or patterns in data without explicit target labels.",
    followUp:
      "Where does reinforcement learning fit into these learning paradigms?",
  },
  {
    category: "AI_ML",
    topic: "Classification Metrics",
    difficulty: "MEDIUM",
    question: "Explain precision, recall, and F1 score.",
    answer:
      "Precision is the fraction of predicted positives that are correct. Recall is the fraction of actual positives detected. F1 is the harmonic mean of precision and recall.",
    followUp:
      "Why can accuracy be misleading for a heavily imbalanced dataset?",
  },
  {
    category: "AI_ML",
    topic: "RAG",
    difficulty: "MEDIUM",
    question: "How does retrieval-augmented generation differ from model fine-tuning?",
    answer:
      "RAG retrieves external context during inference and supplies it to a generation model. Fine-tuning changes the model's parameters through training. Both approaches can be used together.",
    followUp:
      "How would you evaluate whether a RAG system is retrieving relevant evidence?",
  },
  {
    category: "AI_ML",
    topic: "Transformers",
    difficulty: "HARD",
    question: "Explain scaled dot-product attention in Transformer models.",
    answer:
      "Attention calculates similarities between queries and keys, scales the scores by the square root of the key dimension, applies softmax, and uses the resulting weights to combine values. The scaling controls score magnitude and helps stabilize the softmax distribution.",
    followUp:
      "Why does standard self-attention become expensive for long sequences?",
  },

  // ================= CORE COMPUTER SCIENCE =================
  {
    category: "CORE_CS",
    topic: "Operating Systems",
    difficulty: "EASY",
    question: "What is the difference between a process and a thread?",
    answer:
      "A process has its own virtual address space and resources. Threads in the same process typically share address space and resources but maintain separate execution stacks.",
    followUp:
      "What synchronization problems can occur when threads share memory?",
  },
  {
    category: "CORE_CS",
    topic: "DBMS",
    difficulty: "MEDIUM",
    question: "What are database indexes, and what trade-offs do they introduce?",
    answer:
      "Indexes maintain searchable structures that speed up suitable queries. They consume additional storage and introduce maintenance overhead on writes.",
    followUp:
      "When might a database choose a table scan instead of an available index?",
  },
  {
    category: "CORE_CS",
    topic: "Computer Networks",
    difficulty: "MEDIUM",
    question: "What happens when you enter a URL into your browser?",
    answer:
      "The browser resolves the hostname, establishes a connection, negotiates TLS for HTTPS, issues HTTP requests, and processes received resources. Rendering involves parsing, resource loading, layout, and painting.",
    followUp:
      "How do DNS caching and connection reuse improve performance?",
  },
  {
    category: "CORE_CS",
    topic: "Deadlocks",
    difficulty: "HARD",
    question: "Explain the necessary conditions for deadlock and common strategies for handling it.",
    answer:
      "Deadlock requires mutual exclusion, hold-and-wait, no preemption, and circular wait. Strategies include prevention, avoidance, detection and recovery, and deliberate non-handling.",
    followUp:
      "How does the Banker's algorithm identify a safe resource allocation?",
  },

  // ================= MACHINE CODING =================
  {
    category: "MACHINE_CODING",
    topic: "CRUD Design",
    difficulty: "EASY",
    question: "Design an in-memory task manager supporting create, delete, complete, and list operations.",
    answer:
      "Define a task entity with a stable identifier and completion state. Separate core operations from storage and presentation. Validate inputs and test state transitions.",
    followUp:
      "How would you add persistence without rewriting the business logic?",
  },
  {
    category: "MACHINE_CODING",
    topic: "Object-Oriented Design",
    difficulty: "MEDIUM",
    question: "Design a parking lot system using object-oriented principles.",
    answer:
      "Model vehicles, parking spots, tickets, and allocation policies separately. Support parking, removal, availability, and fee calculation through clear interfaces.",
    followUp:
      "How would you extend the design for multiple floors and different vehicle sizes?",
  },
  {
    category: "MACHINE_CODING",
    topic: "LRU Cache",
    difficulty: "MEDIUM",
    question: "Implement an LRU cache with O(1) average-time get and put operations.",
    answer:
      "Use a hash map for constant-average-time key lookup and a doubly linked list to maintain usage order. Move accessed nodes to the most-recent position and evict the least-recent node when full.",
    followUp:
      "How would you make the cache safe under concurrent access?",
  },
  {
    category: "MACHINE_CODING",
    topic: "Rate Limiting",
    difficulty: "HARD",
    question: "Design a thread-safe token bucket rate limiter.",
    answer:
      "Track current tokens, refill rate, capacity, and the last update time. Synchronize refill and consumption operations to prevent concurrent requests from overspending the available tokens.",
    followUp:
      "How would you implement the same logic across multiple distributed servers?",
  },

  // ================= BEHAVIORAL =================
  {
    category: "BEHAVIORAL",
    topic: "Teamwork",
    difficulty: "EASY",
    question: "Describe a situation where you collaborated with a team to solve a difficult problem.",
    answer:
      "A strong response describes the situation, the candidate's responsibility, the actions they took, and the result. Specific examples and personal contributions are more informative than generic claims.",
    followUp:
      "What was your individual contribution to the outcome?",
  },
  {
    category: "BEHAVIORAL",
    topic: "Conflict Resolution",
    difficulty: "MEDIUM",
    question: "Tell me about a disagreement with a teammate and how you resolved it.",
    answer:
      "A strong response should explain the disagreement, evidence considered, communication approach, and final outcome. It should demonstrate professionalism and constructive problem solving.",
    followUp:
      "What would you do if the disagreement remained unresolved?",
  },
  {
    category: "BEHAVIORAL",
    topic: "Leadership",
    difficulty: "MEDIUM",
    question: "Describe a time you took initiative without being formally assigned leadership.",
    answer:
      "An effective response identifies why initiative was needed, the steps taken, how others were involved, and what changed because of the candidate's actions.",
    followUp:
      "How did you gain cooperation from people you did not directly manage?",
  },
  {
    category: "BEHAVIORAL",
    topic: "Learning from Failure",
    difficulty: "HARD",
    question: "Describe a significant professional mistake and how it changed your approach.",
    answer:
      "A strong response acknowledges personal responsibility, outlines the impact, and demonstrates concrete corrective actions. The candidate should explain how the lessons affected subsequent decisions.",
    followUp:
      "What early-warning signs would help you prevent a similar mistake?",
  },

  // ================= MOBILE =================
  {
    category: "MOBILE",
    topic: "React Native",
    difficulty: "EASY",
    question: "What is React Native, and how does it differ from React for web applications?",
    answer:
      "React Native uses React's component model to develop apps targeting native platform components instead of browser DOM elements. It provides integrations with mobile platform features.",
    followUp:
      "When would you need to implement a native module?",
  },
  {
    category: "MOBILE",
    topic: "App Lifecycle",
    difficulty: "MEDIUM",
    question: "How should a mobile application handle moving between foreground and background?",
    answer:
      "Persist important state, pause unnecessary work, and respect operating-system lifecycle restrictions. Restore state carefully when the application becomes active again.",
    followUp:
      "How would you recover an unfinished workflow after the app is terminated?",
  },
  {
    category: "MOBILE",
    topic: "Offline Synchronization",
    difficulty: "MEDIUM",
    question: "How would you implement offline-first functionality in a mobile application?",
    answer:
      "Store data locally, queue changes while offline, and synchronize when connectivity returns. Resolve conflicts using a defined policy such as version checks or user-assisted merging.",
    followUp:
      "What happens if two devices modify the same record while offline?",
  },
  {
    category: "MOBILE",
    topic: "Credential Security",
    difficulty: "HARD",
    question: "How would you securely store authentication credentials in a mobile application?",
    answer:
      "Use platform-provided secure storage mechanisms, minimize token lifetime, avoid logging secrets, and enforce authorization on the backend. Secure storage reduces exposure but does not make a client fully trustworthy.",
    followUp:
      "How would you implement refresh-token rotation and revocation?",
  },
];

export const QUESTION_BANK = questions.map((question, index) => ({
  id: `PREPT-${String(index + 1).padStart(3, "0")}`,
  ...question,
  source: "QUESTION_BANK",
}));

export const QUESTION_CATEGORIES = [
  ...new Set(QUESTION_BANK.map((q) => q.category)),
];
