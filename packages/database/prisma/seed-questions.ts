import { PrismaClient, Difficulty } from './generated/client';

const prisma = new PrismaClient();

interface QuestionSeed {
  content: string;
  category: string;
  difficulty: Difficulty;
  position: string;
  skillTags: string[];
  scoringCriteria?: {
    keywords?: string[];
    keyPoints?: string[];
  };
  expectedDuration?: number; // in seconds
}

// ============================================================================
// Software Engineer Questions (50 questions)
// ============================================================================

const softwareEngineerQuestions: QuestionSeed[] = [
  // Technical - Easy (10)
  {
    content: 'Explain the difference between let, const, and var in JavaScript.',
    category: 'TECHNICAL',
    difficulty: 'EASY',
    position: 'Software Engineer',
    skillTags: ['JavaScript', 'ES6', 'Variables'],
    expectedDuration: 120,
    scoringCriteria: {
      keywords: ['scope', 'hoisting', 'block', 'function'],
      keyPoints: ['const is immutable', 'let is block-scoped', 'var is function-scoped'],
    },
  },
  {
    content: 'What is the purpose of version control systems like Git?',
    category: 'TECHNICAL',
    difficulty: 'EASY',
    position: 'Software Engineer',
    skillTags: ['Git', 'Version Control'],
    expectedDuration: 120,
  },
  {
    content: 'Explain what an API is and give an example of how you would use one.',
    category: 'TECHNICAL',
    difficulty: 'EASY',
    position: 'Software Engineer',
    skillTags: ['API', 'REST', 'Web Development'],
    expectedDuration: 120,
  },
  {
    content: 'What is the difference between HTTP GET and POST requests?',
    category: 'TECHNICAL',
    difficulty: 'EASY',
    position: 'Software Engineer',
    skillTags: ['HTTP', 'Web', 'REST'],
    expectedDuration: 90,
  },
  {
    content: 'Describe the purpose of a database index.',
    category: 'TECHNICAL',
    difficulty: 'EASY',
    position: 'Software Engineer',
    skillTags: ['Database', 'SQL', 'Performance'],
    expectedDuration: 120,
  },
  {
    content: 'What is the difference between an array and a linked list?',
    category: 'TECHNICAL',
    difficulty: 'EASY',
    position: 'Software Engineer',
    skillTags: ['Data Structures', 'Arrays', 'Linked Lists'],
    expectedDuration: 120,
  },
  {
    content: 'Explain what a callback function is in JavaScript.',
    category: 'TECHNICAL',
    difficulty: 'EASY',
    position: 'Software Engineer',
    skillTags: ['JavaScript', 'Callbacks', 'Async'],
    expectedDuration: 120,
  },
  {
    content: 'What is the purpose of CSS in web development?',
    category: 'TECHNICAL',
    difficulty: 'EASY',
    position: 'Software Engineer',
    skillTags: ['CSS', 'Frontend', 'Styling'],
    expectedDuration: 90,
  },
  {
    content: 'What does it mean for code to be "DRY"?',
    category: 'TECHNICAL',
    difficulty: 'EASY',
    position: 'Software Engineer',
    skillTags: ['Best Practices', 'Code Quality'],
    expectedDuration: 90,
  },
  {
    content: 'Explain the concept of a for loop and when you would use one.',
    category: 'TECHNICAL',
    difficulty: 'EASY',
    position: 'Software Engineer',
    skillTags: ['Programming', 'Loops', 'Control Flow'],
    expectedDuration: 90,
  },

  // Technical - Medium (15)
  {
    content: 'Explain closures in JavaScript with an example.',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Software Engineer',
    skillTags: ['JavaScript', 'Closures'],
    expectedDuration: 180,
    scoringCriteria: {
      keywords: ['lexical scope', 'outer variable', 'memory'],
      keyPoints: ['Function remembers environment', 'Data privacy'],
    },
  },
  {
    content: 'What is the difference between SQL and NoSQL databases? When would you choose one over the other?',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Software Engineer',
    skillTags: ['Database', 'SQL', 'NoSQL', 'Architecture'],
    expectedDuration: 180,
  },
  {
    content: 'Explain the concept of promises in JavaScript and how they differ from callbacks.',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Software Engineer',
    skillTags: ['JavaScript', 'Promises', 'Async'],
    expectedDuration: 180,
  },
  {
    content: 'What is RESTful API design? Describe its key principles.',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Software Engineer',
    skillTags: ['REST', 'API', 'Architecture'],
    expectedDuration: 180,
  },
  {
    content: 'Explain the concept of Object-Oriented Programming and its main pillars.',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Software Engineer',
    skillTags: ['OOP', 'Design Patterns'],
    expectedDuration: 180,
  },
  {
    content: 'What is a race condition and how would you prevent it?',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Software Engineer',
    skillTags: ['Concurrency', 'Threading', 'Debugging'],
    expectedDuration: 180,
  },
  {
    content: 'Explain the difference between unit tests, integration tests, and end-to-end tests.',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Software Engineer',
    skillTags: ['Testing', 'QA', 'Best Practices'],
    expectedDuration: 180,
  },
  {
    content: 'What is dependency injection and why is it useful?',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Software Engineer',
    skillTags: ['Design Patterns', 'Architecture', 'Testing'],
    expectedDuration: 180,
  },
  {
    content: 'Describe the event loop in JavaScript and how it handles asynchronous operations.',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Software Engineer',
    skillTags: ['JavaScript', 'Event Loop', 'Async'],
    expectedDuration: 240,
  },
  {
    content: 'What is caching and when would you implement it in a web application?',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Software Engineer',
    skillTags: ['Performance', 'Caching', 'Optimization'],
    expectedDuration: 180,
  },
  {
    content: 'Explain the concept of Big O notation and give examples of different time complexities.',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Software Engineer',
    skillTags: ['Algorithms', 'Complexity', 'Data Structures'],
    expectedDuration: 240,
  },
  {
    content: 'What is the difference between authentication and authorization?',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Software Engineer',
    skillTags: ['Security', 'Authentication', 'Authorization'],
    expectedDuration: 120,
  },
  {
    content: 'Explain how you would implement pagination in a REST API.',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Software Engineer',
    skillTags: ['API', 'REST', 'Performance'],
    expectedDuration: 180,
  },
  {
    content: 'What are microservices and what are their advantages and disadvantages?',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Software Engineer',
    skillTags: ['Architecture', 'Microservices', 'System Design'],
    expectedDuration: 240,
  },
  {
    content: 'Describe how you would debug a production issue that is hard to reproduce.',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Software Engineer',
    skillTags: ['Debugging', 'Problem Solving', 'Production'],
    expectedDuration: 240,
  },

  // Technical - Hard (10)
  {
    content: 'Design a URL shortening service like bit.ly. What are the key components and how would you handle scaling?',
    category: 'TECHNICAL',
    difficulty: 'HARD',
    position: 'Software Engineer',
    skillTags: ['System Design', 'Scalability', 'Architecture'],
    expectedDuration: 600,
  },
  {
    content: 'Explain how garbage collection works in JavaScript. What are memory leaks and how do you prevent them?',
    category: 'TECHNICAL',
    difficulty: 'HARD',
    position: 'Software Engineer',
    skillTags: ['JavaScript', 'Memory Management', 'Performance'],
    expectedDuration: 300,
  },
  {
    content: 'Design a distributed cache system. What consistency trade-offs would you make?',
    category: 'TECHNICAL',
    difficulty: 'HARD',
    position: 'Software Engineer',
    skillTags: ['System Design', 'Distributed Systems', 'Caching'],
    expectedDuration: 600,
  },
  {
    content: 'Explain the CAP theorem and how it applies to distributed databases.',
    category: 'TECHNICAL',
    difficulty: 'HARD',
    position: 'Software Engineer',
    skillTags: ['Distributed Systems', 'Database', 'CAP'],
    expectedDuration: 300,
  },
  {
    content: 'How would you design a real-time notification system for a social media platform?',
    category: 'TECHNICAL',
    difficulty: 'HARD',
    position: 'Software Engineer',
    skillTags: ['System Design', 'Real-time', 'Scalability'],
    expectedDuration: 600,
  },
  {
    content: 'Explain the concept of eventual consistency and when it is acceptable to use.',
    category: 'TECHNICAL',
    difficulty: 'HARD',
    position: 'Software Engineer',
    skillTags: ['Distributed Systems', 'Consistency', 'Architecture'],
    expectedDuration: 300,
  },
  {
    content: 'Design a rate limiter for an API. What algorithms would you consider?',
    category: 'TECHNICAL',
    difficulty: 'HARD',
    position: 'Software Engineer',
    skillTags: ['System Design', 'API', 'Algorithms'],
    expectedDuration: 480,
  },
  {
    content: 'How would you implement a search autocomplete feature for a large-scale e-commerce site?',
    category: 'TECHNICAL',
    difficulty: 'HARD',
    position: 'Software Engineer',
    skillTags: ['System Design', 'Search', 'Trie'],
    expectedDuration: 480,
  },
  {
    content: 'Explain how container orchestration tools like Kubernetes work at a high level.',
    category: 'TECHNICAL',
    difficulty: 'HARD',
    position: 'Software Engineer',
    skillTags: ['DevOps', 'Kubernetes', 'Containers'],
    expectedDuration: 300,
  },
  {
    content: 'Describe how you would implement a distributed transaction across multiple microservices.',
    category: 'TECHNICAL',
    difficulty: 'HARD',
    position: 'Software Engineer',
    skillTags: ['Microservices', 'Transactions', 'Distributed Systems'],
    expectedDuration: 480,
  },

  // Technical - Expert (5)
  {
    content: 'Design a globally distributed database that supports both strong consistency for financial transactions and eventual consistency for analytics queries.',
    category: 'TECHNICAL',
    difficulty: 'EXPERT',
    position: 'Software Engineer',
    skillTags: ['System Design', 'Distributed Systems', 'Database'],
    expectedDuration: 900,
  },
  {
    content: 'How would you design a system to handle 10 million concurrent WebSocket connections?',
    category: 'TECHNICAL',
    difficulty: 'EXPERT',
    position: 'Software Engineer',
    skillTags: ['System Design', 'Scalability', 'WebSocket'],
    expectedDuration: 900,
  },
  {
    content: 'Design a machine learning pipeline that can process and train on petabytes of data in near real-time.',
    category: 'TECHNICAL',
    difficulty: 'EXPERT',
    position: 'Software Engineer',
    skillTags: ['ML Infrastructure', 'Big Data', 'System Design'],
    expectedDuration: 900,
  },
  {
    content: 'Explain consensus algorithms like Raft or Paxos and when you would implement your own vs using existing solutions.',
    category: 'TECHNICAL',
    difficulty: 'EXPERT',
    position: 'Software Engineer',
    skillTags: ['Distributed Systems', 'Consensus', 'Algorithms'],
    expectedDuration: 600,
  },
  {
    content: 'Design a multi-region active-active deployment architecture with disaster recovery capabilities.',
    category: 'TECHNICAL',
    difficulty: 'EXPERT',
    position: 'Software Engineer',
    skillTags: ['Architecture', 'DR', 'Multi-region'],
    expectedDuration: 900,
  },

  // Behavioral - Easy (5)
  {
    content: 'Tell me about a time when you had to learn a new technology quickly.',
    category: 'BEHAVIORAL',
    difficulty: 'EASY',
    position: 'Software Engineer',
    skillTags: ['Learning', 'Adaptability'],
    expectedDuration: 180,
  },
  {
    content: 'How do you stay current with new technologies and industry trends?',
    category: 'BEHAVIORAL',
    difficulty: 'EASY',
    position: 'Software Engineer',
    skillTags: ['Learning', 'Professional Development'],
    expectedDuration: 120,
  },
  {
    content: 'Describe your ideal work environment.',
    category: 'BEHAVIORAL',
    difficulty: 'EASY',
    position: 'Software Engineer',
    skillTags: ['Culture Fit', 'Work Style'],
    expectedDuration: 120,
  },
  {
    content: 'What motivates you as a software engineer?',
    category: 'BEHAVIORAL',
    difficulty: 'EASY',
    position: 'Software Engineer',
    skillTags: ['Motivation', 'Self-Awareness'],
    expectedDuration: 120,
  },
  {
    content: 'How do you approach code reviews?',
    category: 'BEHAVIORAL',
    difficulty: 'EASY',
    position: 'Software Engineer',
    skillTags: ['Collaboration', 'Code Quality'],
    expectedDuration: 180,
  },

  // Behavioral - Medium (3)
  {
    content: 'Tell me about a challenging bug you encountered and how you resolved it.',
    category: 'BEHAVIORAL',
    difficulty: 'MEDIUM',
    position: 'Software Engineer',
    skillTags: ['Problem Solving', 'Debugging'],
    expectedDuration: 240,
  },
  {
    content: 'Describe a time when you disagreed with a technical decision made by your team.',
    category: 'BEHAVIORAL',
    difficulty: 'MEDIUM',
    position: 'Software Engineer',
    skillTags: ['Conflict Resolution', 'Communication'],
    expectedDuration: 240,
  },
  {
    content: 'Tell me about a project you are most proud of and why.',
    category: 'BEHAVIORAL',
    difficulty: 'MEDIUM',
    position: 'Software Engineer',
    skillTags: ['Achievement', 'Technical Excellence'],
    expectedDuration: 300,
  },

  // Behavioral - Hard (2)
  {
    content: 'Describe a situation where you had to make a trade-off between code quality and meeting a deadline.',
    category: 'BEHAVIORAL',
    difficulty: 'HARD',
    position: 'Software Engineer',
    skillTags: ['Decision Making', 'Prioritization'],
    expectedDuration: 300,
  },
  {
    content: 'Tell me about a time when you had to lead a project without formal authority.',
    category: 'BEHAVIORAL',
    difficulty: 'HARD',
    position: 'Software Engineer',
    skillTags: ['Leadership', 'Influence'],
    expectedDuration: 300,
  },
];

// ============================================================================
// Product Manager Questions (20 questions)
// ============================================================================

const productManagerQuestions: QuestionSeed[] = [
  // Technical - Medium (5)
  {
    content: 'How would you prioritize features for a product roadmap?',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Product Manager',
    skillTags: ['Prioritization', 'Strategy', 'Roadmap'],
    expectedDuration: 300,
  },
  {
    content: 'Explain how you would define and measure success metrics for a new feature.',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Product Manager',
    skillTags: ['Metrics', 'Analytics', 'KPIs'],
    expectedDuration: 240,
  },
  {
    content: 'How do you balance user needs with business objectives?',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Product Manager',
    skillTags: ['Strategy', 'User Focus', 'Business'],
    expectedDuration: 240,
  },
  {
    content: 'Describe your process for gathering and analyzing user feedback.',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Product Manager',
    skillTags: ['User Research', 'Feedback', 'Analysis'],
    expectedDuration: 240,
  },
  {
    content: 'How do you work with engineering teams to estimate effort and set timelines?',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Product Manager',
    skillTags: ['Collaboration', 'Estimation', 'Planning'],
    expectedDuration: 240,
  },

  // Technical - Hard (3)
  {
    content: 'How would you approach entering a new market segment with an existing product?',
    category: 'TECHNICAL',
    difficulty: 'HARD',
    position: 'Product Manager',
    skillTags: ['Market Analysis', 'Strategy', 'Growth'],
    expectedDuration: 480,
  },
  {
    content: 'Describe how you would sunset a product feature that users rely on.',
    category: 'TECHNICAL',
    difficulty: 'HARD',
    position: 'Product Manager',
    skillTags: ['Communication', 'Change Management', 'Strategy'],
    expectedDuration: 360,
  },
  {
    content: 'How do you make data-driven decisions when data is limited or conflicting?',
    category: 'TECHNICAL',
    difficulty: 'HARD',
    position: 'Product Manager',
    skillTags: ['Data Analysis', 'Decision Making', 'Uncertainty'],
    expectedDuration: 360,
  },

  // Situational - Medium (5)
  {
    content: 'Your most important feature launch is delayed by two weeks. How do you handle stakeholder communication?',
    category: 'SITUATIONAL',
    difficulty: 'MEDIUM',
    position: 'Product Manager',
    skillTags: ['Communication', 'Stakeholder Management'],
    expectedDuration: 240,
  },
  {
    content: 'Engineering says your feature will take 6 months, but leadership wants it in 3. What do you do?',
    category: 'SITUATIONAL',
    difficulty: 'MEDIUM',
    position: 'Product Manager',
    skillTags: ['Negotiation', 'Scoping', 'Prioritization'],
    expectedDuration: 300,
  },
  {
    content: 'You receive conflicting feedback from two major customers. How do you proceed?',
    category: 'SITUATIONAL',
    difficulty: 'MEDIUM',
    position: 'Product Manager',
    skillTags: ['Decision Making', 'Customer Focus'],
    expectedDuration: 240,
  },
  {
    content: 'A competitor just launched a feature you had planned. How do you respond?',
    category: 'SITUATIONAL',
    difficulty: 'MEDIUM',
    position: 'Product Manager',
    skillTags: ['Competitive Analysis', 'Strategy'],
    expectedDuration: 240,
  },
  {
    content: 'Your team is demoralized after a failed product launch. How do you rebuild momentum?',
    category: 'SITUATIONAL',
    difficulty: 'MEDIUM',
    position: 'Product Manager',
    skillTags: ['Leadership', 'Team Management'],
    expectedDuration: 240,
  },

  // Case Study - Hard (7)
  {
    content: 'Design a new feature for Instagram to increase user engagement for the 18-24 age group.',
    category: 'CASE_STUDY',
    difficulty: 'HARD',
    position: 'Product Manager',
    skillTags: ['Product Design', 'User Research', 'Strategy'],
    expectedDuration: 900,
  },
  {
    content: 'How would you increase user retention for a subscription-based fitness app?',
    category: 'CASE_STUDY',
    difficulty: 'HARD',
    position: 'Product Manager',
    skillTags: ['Retention', 'Analytics', 'Strategy'],
    expectedDuration: 600,
  },
  {
    content: 'Design a product strategy for a new food delivery service in a competitive market.',
    category: 'CASE_STUDY',
    difficulty: 'HARD',
    position: 'Product Manager',
    skillTags: ['Go-to-Market', 'Competitive Analysis', 'Strategy'],
    expectedDuration: 900,
  },
  {
    content: 'How would you monetize a free productivity tool with 1 million users?',
    category: 'CASE_STUDY',
    difficulty: 'HARD',
    position: 'Product Manager',
    skillTags: ['Monetization', 'Business Model', 'Strategy'],
    expectedDuration: 600,
  },
  {
    content: 'Redesign the checkout experience for an e-commerce platform to reduce cart abandonment.',
    category: 'CASE_STUDY',
    difficulty: 'HARD',
    position: 'Product Manager',
    skillTags: ['UX', 'Conversion', 'E-commerce'],
    expectedDuration: 600,
  },
  {
    content: 'How would you prioritize building a mobile app vs improving the web experience for a SaaS product?',
    category: 'CASE_STUDY',
    difficulty: 'HARD',
    position: 'Product Manager',
    skillTags: ['Strategy', 'Platform', 'Prioritization'],
    expectedDuration: 600,
  },
  {
    content: 'Design a strategy for expanding a B2B product into the small business market.',
    category: 'CASE_STUDY',
    difficulty: 'HARD',
    position: 'Product Manager',
    skillTags: ['Market Expansion', 'B2B', 'Strategy'],
    expectedDuration: 900,
  },
];

// ============================================================================
// Data Scientist Questions (15 questions)
// ============================================================================

const dataScienceQuestions: QuestionSeed[] = [
  // Technical - Medium (8)
  {
    content: 'Explain the difference between supervised and unsupervised learning with examples.',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Data Scientist',
    skillTags: ['Machine Learning', 'Theory'],
    expectedDuration: 240,
  },
  {
    content: 'How would you handle missing data in a dataset?',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Data Scientist',
    skillTags: ['Data Cleaning', 'Statistics'],
    expectedDuration: 240,
  },
  {
    content: 'Explain the bias-variance tradeoff in machine learning.',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Data Scientist',
    skillTags: ['Machine Learning', 'Model Selection'],
    expectedDuration: 240,
  },
  {
    content: 'What is regularization and why is it important?',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Data Scientist',
    skillTags: ['Machine Learning', 'Regularization'],
    expectedDuration: 180,
  },
  {
    content: 'Explain the difference between precision and recall. When would you optimize for each?',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Data Scientist',
    skillTags: ['Metrics', 'Evaluation'],
    expectedDuration: 240,
  },
  {
    content: 'How would you validate a machine learning model before deploying it?',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Data Scientist',
    skillTags: ['Model Validation', 'Testing'],
    expectedDuration: 300,
  },
  {
    content: 'Explain how gradient descent works.',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Data Scientist',
    skillTags: ['Optimization', 'Algorithms'],
    expectedDuration: 240,
  },
  {
    content: 'What is feature engineering and why is it important?',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Data Scientist',
    skillTags: ['Feature Engineering', 'Data Preparation'],
    expectedDuration: 240,
  },

  // Technical - Hard (7)
  {
    content: 'Explain how neural networks learn through backpropagation.',
    category: 'TECHNICAL',
    difficulty: 'HARD',
    position: 'Data Scientist',
    skillTags: ['Deep Learning', 'Neural Networks'],
    expectedDuration: 360,
  },
  {
    content: 'How would you design an A/B test to measure the impact of a new recommendation algorithm?',
    category: 'TECHNICAL',
    difficulty: 'HARD',
    position: 'Data Scientist',
    skillTags: ['A/B Testing', 'Statistics', 'Experimentation'],
    expectedDuration: 480,
  },
  {
    content: 'Explain the attention mechanism in transformer models.',
    category: 'TECHNICAL',
    difficulty: 'HARD',
    position: 'Data Scientist',
    skillTags: ['NLP', 'Transformers', 'Deep Learning'],
    expectedDuration: 480,
  },
  {
    content: 'How would you build a real-time fraud detection system?',
    category: 'TECHNICAL',
    difficulty: 'HARD',
    position: 'Data Scientist',
    skillTags: ['Fraud Detection', 'Real-time ML'],
    expectedDuration: 600,
  },
  {
    content: 'Explain how you would handle class imbalance in a classification problem.',
    category: 'TECHNICAL',
    difficulty: 'HARD',
    position: 'Data Scientist',
    skillTags: ['Imbalanced Data', 'Classification'],
    expectedDuration: 360,
  },
  {
    content: 'Design a recommendation system for a streaming platform. What approaches would you consider?',
    category: 'TECHNICAL',
    difficulty: 'HARD',
    position: 'Data Scientist',
    skillTags: ['Recommendation Systems', 'Collaborative Filtering'],
    expectedDuration: 600,
  },
  {
    content: 'How would you explain a complex machine learning model to non-technical stakeholders?',
    category: 'TECHNICAL',
    difficulty: 'HARD',
    position: 'Data Scientist',
    skillTags: ['Explainability', 'Communication'],
    expectedDuration: 300,
  },
];

// ============================================================================
// Designer Questions (10 questions)
// ============================================================================

const designerQuestions: QuestionSeed[] = [
  // Role-specific - Medium (6)
  {
    content: 'Walk me through your design process from discovery to delivery.',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Designer',
    skillTags: ['Design Process', 'Methodology'],
    expectedDuration: 300,
  },
  {
    content: 'How do you incorporate user feedback into your designs?',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Designer',
    skillTags: ['User Research', 'Iteration'],
    expectedDuration: 240,
  },
  {
    content: 'Explain your approach to creating a design system.',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Designer',
    skillTags: ['Design Systems', 'Consistency'],
    expectedDuration: 300,
  },
  {
    content: 'How do you balance aesthetics with usability?',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Designer',
    skillTags: ['UX', 'Visual Design'],
    expectedDuration: 240,
  },
  {
    content: 'Describe how you collaborate with product managers and engineers.',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Designer',
    skillTags: ['Collaboration', 'Communication'],
    expectedDuration: 240,
  },
  {
    content: 'How do you approach designing for accessibility?',
    category: 'TECHNICAL',
    difficulty: 'MEDIUM',
    position: 'Designer',
    skillTags: ['Accessibility', 'Inclusive Design'],
    expectedDuration: 240,
  },

  // Role-specific - Hard (4)
  {
    content: 'Design a mobile onboarding experience for a complex financial app.',
    category: 'CASE_STUDY',
    difficulty: 'HARD',
    position: 'Designer',
    skillTags: ['UX Design', 'Onboarding', 'Mobile'],
    expectedDuration: 900,
  },
  {
    content: 'How would you redesign a legacy enterprise application to improve user experience?',
    category: 'CASE_STUDY',
    difficulty: 'HARD',
    position: 'Designer',
    skillTags: ['Enterprise UX', 'Redesign'],
    expectedDuration: 900,
  },
  {
    content: 'Design a dashboard for data analysts that surfaces key insights effectively.',
    category: 'CASE_STUDY',
    difficulty: 'HARD',
    position: 'Designer',
    skillTags: ['Data Visualization', 'Dashboard'],
    expectedDuration: 900,
  },
  {
    content: 'How would you measure the success of a design you shipped?',
    category: 'TECHNICAL',
    difficulty: 'HARD',
    position: 'Designer',
    skillTags: ['Metrics', 'Evaluation'],
    expectedDuration: 300,
  },
];

// ============================================================================
// Universal Questions (10 questions - all roles)
// ============================================================================

const universalQuestions: QuestionSeed[] = [
  // Culture Fit - Easy (5)
  {
    content: 'Why are you interested in this position?',
    category: 'CULTURE_FIT',
    difficulty: 'EASY',
    position: 'Universal',
    skillTags: ['Motivation', 'Interest'],
    expectedDuration: 120,
  },
  {
    content: 'What do you know about our company and what attracted you to us?',
    category: 'CULTURE_FIT',
    difficulty: 'EASY',
    position: 'Universal',
    skillTags: ['Research', 'Culture Fit'],
    expectedDuration: 180,
  },
  {
    content: 'How do you prefer to receive feedback?',
    category: 'CULTURE_FIT',
    difficulty: 'EASY',
    position: 'Universal',
    skillTags: ['Communication', 'Growth Mindset'],
    expectedDuration: 120,
  },
  {
    content: 'Describe your ideal team structure and collaboration style.',
    category: 'CULTURE_FIT',
    difficulty: 'EASY',
    position: 'Universal',
    skillTags: ['Teamwork', 'Work Style'],
    expectedDuration: 180,
  },
  {
    content: 'What are your long-term career goals?',
    category: 'CULTURE_FIT',
    difficulty: 'EASY',
    position: 'Universal',
    skillTags: ['Goals', 'Ambition'],
    expectedDuration: 180,
  },

  // Culture Fit - Medium (3)
  {
    content: 'Tell me about a time when you failed. What did you learn from it?',
    category: 'CULTURE_FIT',
    difficulty: 'MEDIUM',
    position: 'Universal',
    skillTags: ['Self-Awareness', 'Growth'],
    expectedDuration: 240,
  },
  {
    content: 'Describe a situation where you had to work with a difficult team member.',
    category: 'CULTURE_FIT',
    difficulty: 'MEDIUM',
    position: 'Universal',
    skillTags: ['Conflict Resolution', 'Teamwork'],
    expectedDuration: 300,
  },
  {
    content: 'How do you handle stress and tight deadlines?',
    category: 'CULTURE_FIT',
    difficulty: 'MEDIUM',
    position: 'Universal',
    skillTags: ['Stress Management', 'Time Management'],
    expectedDuration: 180,
  },

  // Brainteaser - Easy (1)
  {
    content: 'If you could have any superpower for work, what would it be and why?',
    category: 'BRAINTEASER',
    difficulty: 'EASY',
    position: 'Universal',
    skillTags: ['Creativity', 'Self-Awareness'],
    expectedDuration: 120,
  },

  // Brainteaser - Medium (1)
  {
    content: 'How would you explain our product to your grandmother?',
    category: 'BRAINTEASER',
    difficulty: 'MEDIUM',
    position: 'Universal',
    skillTags: ['Communication', 'Simplification'],
    expectedDuration: 180,
  },
];

// ============================================================================
// Main Seed Function
// ============================================================================

async function seedQuestions() {
  console.log('🌱 Seeding questions...');

  // First, ensure we have a default user for createdById
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@warmscreen.com' },
    update: {},
    create: {
      email: 'admin@warmscreen.com',
      name: 'Admin User',
      role: 'ADMIN',
    },
  });

  console.log('✅ Admin user ready:', adminUser.email);

  const allQuestions = [
    ...softwareEngineerQuestions,
    ...productManagerQuestions,
    ...dataScienceQuestions,
    ...designerQuestions,
    ...universalQuestions,
  ];

  let created = 0;
  let skipped = 0;

  for (const question of allQuestions) {
    // Check if question already exists (by content and position)
    const existing = await prisma.question.findFirst({
      where: {
        content: question.content,
        position: question.position,
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.question.create({
      data: {
        content: question.content,
        category: question.category,
        difficulty: question.difficulty,
        position: question.position,
        skillTags: question.skillTags,
        createdById: adminUser.id,
      },
    });

    created++;
  }

  console.log(`✅ Created ${created} questions`);
  console.log(`⏭️ Skipped ${skipped} existing questions`);
  console.log(`📊 Total questions in database: ${created + skipped}`);
  console.log(`
Question breakdown:
  - Software Engineer: ${softwareEngineerQuestions.length}
  - Product Manager: ${productManagerQuestions.length}
  - Data Scientist: ${dataScienceQuestions.length}
  - Designer: ${designerQuestions.length}
  - Universal: ${universalQuestions.length}
  - Total: ${allQuestions.length}
  `);
}

export { seedQuestions };

// Run directly if this file is executed
if (require.main === module) {
  seedQuestions()
    .catch((e) => {
      console.error('❌ Error seeding questions:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
