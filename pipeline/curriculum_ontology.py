from copy import deepcopy


CURRICULUM_ONTOLOGY = {
    "version": 2,
    "topics": [
        {
            "id": "programming-fundamentals",
            "label": "Programming Fundamentals",
            "category": "core",
            "aliases": [
                "Basic Programming",
                "Programming Concepts",
                "Basic programming concepts",
                "Programming Language Fundamentals",
                "Computer Science Fundamentals",
            ],
            "prerequisites": [],
        },
        {
            "id": "object-oriented-programming",
            "label": "Object-Oriented Programming",
            "category": "core",
            "aliases": ["OOP", "Object Oriented Programming", "Object-Oriented Programming Concepts"],
            "prerequisites": ["programming-fundamentals"],
        },
        {
            "id": "object-oriented-design",
            "label": "Object-Oriented Design",
            "category": "core",
            "aliases": [
                "OOD",
                "Object Oriented Design",
                "Object-Oriented Design Principles",
                "Design Pattern",
                "Design Patterns",
            ],
            "prerequisites": ["object-oriented-programming"],
        },
        {
            "id": "algorithms",
            "label": "Algorithms",
            "category": "core",
            "aliases": [
                "Algorithm Design",
                "Algorithm Fundamentals",
                "Algorithmic Problem Solving",
                "NP-Completeness",
                "NP-Complete Problems",
                "Performance Optimization",
                "Algorithm Optimization",
            ],
            "prerequisites": ["programming-fundamentals"],
        },
        {
            "id": "data-structures",
            "label": "Data Structures",
            "category": "core",
            "aliases": [
                "Data Structures Fundamentals",
                "Data Structures and Algorithms",
                "Data Structures and Algorithms in Python",
            ],
            "prerequisites": ["programming-fundamentals"],
        },
        {
            "id": "big-o-notation",
            "label": "Big O Notation",
            "category": "core",
            "aliases": [
                "Asymptotic Analysis",
                "Time Complexity",
                "Algorithm Analysis",
                "Computational Complexity",
                "Algorithm Analysis and Complexity",
                "Asymptotic Notation and Algorithm Complexity",
                "Time Complexity Analysis",
                "Space Complexity Analysis",
            ],
            "prerequisites": ["algorithms"],
        },
        {
            "id": "arrays",
            "label": "Arrays",
            "category": "core",
            "aliases": ["Array"],
            "prerequisites": ["data-structures"],
        },
        {
            "id": "linked-lists",
            "label": "Linked Lists",
            "category": "core",
            "aliases": ["Linked List", "Singly-Linked List", "Doubly-Linked List"],
            "prerequisites": ["data-structures"],
        },
        {
            "id": "coding-patterns",
            "label": "Coding Patterns",
            "category": "interview",
            "aliases": [
                "Coding Interview Patterns",
                "Coding Patterns for Algorithmic Problem Solving",
                "Interview Patterns",
                "Algorithmic Templates",
            ],
            "prerequisites": ["coding-interview-preparation", "algorithms", "data-structures"],
        },
        {
            "id": "two-pointers",
            "label": "Two Pointers",
            "category": "core",
            "aliases": ["Two Pointer Technique", "Two-Pointer Technique", "Two Pointer"],
            "prerequisites": ["arrays"],
        },
        {
            "id": "sliding-window",
            "label": "Sliding Window",
            "category": "core",
            "aliases": [
                "Sliding Window Technique",
                "Sliding Window Pattern",
                "Window Sliding Technique",
            ],
            "prerequisites": ["arrays", "two-pointers", "hash-tables"],
        },
        {
            "id": "stacks",
            "label": "Stacks",
            "category": "core",
            "aliases": ["Stack"],
            "prerequisites": ["data-structures"],
        },
        {
            "id": "queues",
            "label": "Queues",
            "category": "core",
            "aliases": ["Queue", "Circular Buffer"],
            "prerequisites": ["data-structures"],
        },
        {
            "id": "hash-tables",
            "label": "Hash Tables",
            "category": "core",
            "aliases": ["Hashing", "Hash Maps", "Dictionaries"],
            "prerequisites": ["data-structures"],
        },
        {
            "id": "trees",
            "label": "Trees",
            "category": "core",
            "aliases": ["Tree", "Tree Traversal", "Intro to Trees", "Tree Data Structure"],
            "prerequisites": ["data-structures"],
        },
        {
            "id": "binary-search-trees",
            "label": "Binary Search Trees",
            "category": "core",
            "aliases": ["Binary Search Tree", "BST"],
            "prerequisites": ["trees", "binary-search"],
        },
        {
            "id": "balanced-search-trees",
            "label": "Balanced Search Trees",
            "category": "core",
            "aliases": ["AA tree", "Red-Black Trees", "Binary Search Trees and Red-Black Trees"],
            "prerequisites": ["binary-search-trees"],
        },
        {
            "id": "heaps",
            "label": "Heaps",
            "category": "core",
            "aliases": ["Binary Heaps", "Priority Queues"],
            "prerequisites": ["trees"],
        },
        {
            "id": "trie",
            "label": "Trie",
            "category": "core",
            "aliases": ["Prefix Tree"],
            "prerequisites": ["trees"],
        },
        {
            "id": "binary-search",
            "label": "Binary Search",
            "category": "core",
            "aliases": ["Binary Search Template"],
            "prerequisites": ["arrays", "big-o-notation"],
        },
        {
            "id": "bitwise-operations",
            "label": "Bitwise Operations",
            "category": "core",
            "aliases": ["Bit Manipulation", "Bit Twiddling"],
            "prerequisites": ["programming-fundamentals"],
        },
        {
            "id": "sorting-algorithms",
            "label": "Sorting Algorithms",
            "category": "core",
            "aliases": ["Sorting", "Merge Sort", "Quick Sort", "Heap Sort", "Stable Sorting Algorithms", "Stable Sort"],
            "prerequisites": ["arrays", "algorithms", "big-o-notation"],
        },
        {
            "id": "merge-sort",
            "label": "Merge Sort",
            "category": "core",
            "aliases": ["Merge Sort for Linked List", "Merge Sort for Linked Lists"],
            "prerequisites": ["divide-and-conquer", "sorting-algorithms"],
        },
        {
            "id": "divide-and-conquer",
            "label": "Divide and Conquer",
            "category": "core",
            "aliases": [
                "Divide and Conquer Algorithms",
                "Divide and Conquer Algorithm",
                "Divide and Conquer Approach",
                "Divide and Conquer (Recursive)",
                "Divide and Conquer Sorting for Linked Lists",
            ],
            "prerequisites": ["algorithms", "recursion"],
        },
        {
            "id": "recursion",
            "label": "Recursion",
            "category": "core",
            "aliases": ["Recursion Basics", "Recursive Problem Solving"],
            "prerequisites": ["programming-fundamentals"],
        },
        {
            "id": "backtracking",
            "label": "Backtracking",
            "category": "core",
            "aliases": [
                "Backtracking Algorithm",
                "Backtracking Algorithms",
                "Recursive Backtracking",
                "Subset Generation (Backtracking)",
                "Branch and Bound",
                "Branch-and-Bound",
            ],
            "prerequisites": ["recursion"],
        },
        {
            "id": "dynamic-programming",
            "label": "Dynamic Programming",
            "category": "core",
            "aliases": ["DP"],
            "prerequisites": ["algorithms", "recursion"],
        },
        {
            "id": "greedy-algorithms",
            "label": "Greedy Algorithms",
            "category": "core",
            "aliases": ["Greedy Algorithm", "Greedy Strategy", "Greedy Approach", "Greedy Method"],
            "prerequisites": ["algorithms", "big-o-notation"],
        },
        {
            "id": "graph-algorithms",
            "label": "Graph Algorithms",
            "category": "core",
            "aliases": ["Graphs", "Graph Theory", "Shortest Path Algorithms", "Graph Traversal", "Graph Search"],
            "prerequisites": ["algorithms", "data-structures"],
        },
        {
            "id": "operating-systems",
            "label": "Operating Systems",
            "category": "systems",
            "aliases": [
                "Operating Systems Concepts",
                "Operating System Concepts",
                "Operating Systems Basics",
                "Operating Systems and System Programming",
                "Dynamic Memory Allocation",
                "Memory Management",
            ],
            "prerequisites": ["programming-fundamentals"],
        },
        {
            "id": "computer-networking",
            "label": "Computer Networking",
            "category": "systems",
            "aliases": [
                "Networking",
                "Networking Fundamentals",
                "Networking Basics",
                "Computer Networking Basics",
                "TCP/IP Model",
                "TCP/IP Stack",
                "DNS",
                "Domain Name System",
                "DHCP",
                "Dynamic Host Configuration Protocol",
            ],
            "prerequisites": ["programming-fundamentals"],
        },
        {
            "id": "internet-protocol",
            "label": "Internet Protocol",
            "category": "systems",
            "aliases": ["Internet Protocol (IP)", "IP Networking"],
            "prerequisites": ["computer-networking"],
        },
        {
            "id": "ip-addressing-and-subnetting",
            "label": "IP Addressing and Subnetting",
            "category": "systems",
            "aliases": [
                "IP Address Types",
                "IP Address Versions",
                "Static IP Address",
                "Subnetting",
                "NAT",
                "Network Address Translation (NAT)",
                "Network Address Translation",
            ],
            "prerequisites": ["internet-protocol"],
        },
        {
            "id": "database-systems",
            "label": "Database Systems",
            "category": "systems",
            "aliases": [
                "Databases",
                "Database Fundamentals",
                "Database Management Systems",
                "Database Design",
                "Database Internals",
                "Database Schema Design",
            ],
            "prerequisites": ["data-structures"],
        },
        {
            "id": "sql-joins",
            "label": "SQL Joins",
            "category": "systems",
            "aliases": ["Join Operations"],
            "prerequisites": ["database-systems"],
        },
        {
            "id": "distributed-systems",
            "label": "Distributed Systems",
            "category": "systems",
            "aliases": [
                "Distributed Systems Fundamentals",
                "Distributed Computing",
                "Distributed System Design",
                "Distributed Computing Systems",
            ],
            "prerequisites": ["computer-networking", "operating-systems", "database-systems"],
        },
        {
            "id": "concurrency",
            "label": "Concurrency",
            "category": "systems",
            "aliases": ["Concurrent Programming", "Concurrency in Computing", "Concurrency in Computer Science"],
            "prerequisites": ["operating-systems"],
        },
        {
            "id": "cap-theorem",
            "label": "CAP Theorem",
            "category": "systems",
            "aliases": ["Consistency Availability Partition Tolerance"],
            "prerequisites": ["distributed-systems"],
        },
        {
            "id": "api-design",
            "label": "API Design",
            "category": "systems",
            "aliases": ["API Design Patterns", "REST API Design", "Service Interfaces"],
            "prerequisites": ["programming-fundamentals", "computer-networking"],
        },
        {
            "id": "load-balancing",
            "label": "Load Balancing",
            "category": "systems",
            "aliases": ["Traffic Distribution", "Layer 4 Load Balancing", "Layer 7 Load Balancing"],
            "prerequisites": ["computer-networking", "distributed-systems"],
        },
        {
            "id": "caching-strategies",
            "label": "Caching Strategies",
            "category": "systems",
            "aliases": [
                "Caching",
                "Cache Design",
                "Distributed Cache Design",
                "Cache Replacement Policies",
                "Cache Eviction Policies",
                "Cache Replacement Algorithms",
            ],
            "prerequisites": ["database-systems", "distributed-systems"],
        },
        {
            "id": "consistent-hashing",
            "label": "Consistent Hashing",
            "category": "systems",
            "aliases": ["Hash Ring"],
            "prerequisites": ["distributed-systems", "caching-strategies"],
        },
        {
            "id": "database-sharding",
            "label": "Database Sharding",
            "category": "systems",
            "aliases": ["Shard Key Design"],
            "prerequisites": ["database-systems", "distributed-systems"],
        },
        {
            "id": "software-architecture",
            "label": "Software Architecture",
            "category": "systems",
            "aliases": [
                "Architecture Design",
                "Software Architecture Patterns",
                "System Architecture",
                "Software Engineering Principles",
            ],
            "prerequisites": ["object-oriented-design"],
        },
        {
            "id": "cloud-computing",
            "label": "Cloud Computing",
            "category": "systems",
            "aliases": ["Cloud Architecture", "Cloud Computing Services", "AWS", "Azure", "GCP"],
            "prerequisites": ["distributed-systems"],
        },
        {
            "id": "microservices-architecture",
            "label": "Microservices Architecture",
            "category": "systems",
            "aliases": ["Microservices", "Service-Oriented Architecture"],
            "prerequisites": ["software-architecture", "distributed-systems", "api-design"],
        },
        {
            "id": "devops-and-deployment",
            "label": "DevOps and Deployment",
            "category": "systems",
            "aliases": [
                "DevOps",
                "Deployment",
                "CI/CD",
                "Containerization and Orchestration",
                "Flask Web Application Deployment",
            ],
            "prerequisites": ["programming-fundamentals", "computer-networking"],
        },
        {
            "id": "site-reliability-engineering",
            "label": "Site Reliability Engineering",
            "category": "systems",
            "aliases": ["SRE", "Reliability Engineering"],
            "prerequisites": ["devops-and-deployment", "distributed-systems", "load-balancing"],
        },
        {
            "id": "system-design-fundamentals",
            "label": "System Design Fundamentals",
            "category": "systems",
            "aliases": [
                "System Design Basics",
                "System Design Concepts",
                "System Design Principles",
                "RADAD Framework for System Design",
            ],
            "prerequisites": [
                "algorithms",
                "data-structures",
                "database-systems",
                "computer-networking",
                "operating-systems",
                "object-oriented-design",
            ],
        },
        {
            "id": "system-design",
            "label": "System Design",
            "category": "systems",
            "aliases": [
                "Large-Scale System Design",
                "Scalable System Design",
                "System Architecture Design",
                "Scalability",
                "Content Delivery Networks (CDNs)",
                "CDNs",
                "Trade-off Analysis",
            ],
            "prerequisites": [
                "system-design-fundamentals",
                "distributed-systems",
                "api-design",
                "load-balancing",
                "caching-strategies",
            ],
        },
        {
            "id": "front-end-system-design",
            "label": "Front-End System Design",
            "category": "systems",
            "aliases": ["Frontend System Design"],
            "prerequisites": ["front-end-interview-preparation", "system-design-fundamentals", "api-design"],
        },
        {
            "id": "competitive-programming",
            "label": "Competitive Programming",
            "category": "interview",
            "aliases": ["Online Judges", "Coding Contest Practice"],
            "prerequisites": ["algorithms", "data-structures", "big-o-notation"],
        },
        {
            "id": "coding-interview-preparation",
            "label": "Coding Interview Preparation",
            "category": "interview",
            "aliases": [
                "Coding Interview",
                "Coding Interviews",
                "Technical Coding Interviews",
                "LeetCode Problems",
                "Coding Practice Platforms",
                "Mock Interviews",
            ],
            "prerequisites": ["algorithms", "data-structures", "big-o-notation"],
        },
        {
            "id": "technical-interview-preparation",
            "label": "Technical Interview Preparation",
            "category": "interview",
            "aliases": [
                "Engineering Interview Preparation",
                "Tech Interview Prep",
                "Software Engineering Interview Preparation",
                "Programming Language Selection for Technical Interviews",
            ],
            "prerequisites": ["coding-interview-preparation", "object-oriented-programming"],
        },
        {
            "id": "behavioral-interview-preparation",
            "label": "Behavioral Interview Preparation",
            "category": "interview",
            "aliases": [
                "Behavioral Interview Techniques",
                "Behavioral Questions",
                "STAR Framework",
                "STAR Method",
                "Behavioral Interview",
                "Behavioral Interview Prep",
                "STAR Framework for Behavioral Interviews",
            ],
            "prerequisites": [],
        },
        {
            "id": "resume-writing",
            "label": "Resume Writing",
            "category": "career",
            "aliases": ["Resume Building", "Resume Preparation", "Software Engineer Resume Writing"],
            "prerequisites": [],
        },
        {
            "id": "salary-negotiation",
            "label": "Salary Negotiation",
            "category": "career",
            "aliases": ["Compensation Negotiation"],
            "prerequisites": [],
        },
        {
            "id": "open-source-contribution",
            "label": "Open Source Contribution",
            "category": "career",
            "aliases": ["Contributing to Open Source Projects", "GitHub Portfolio"],
            "prerequisites": ["programming-fundamentals"],
        },
        {
            "id": "front-end-interview-preparation",
            "label": "Front-End Interview Preparation",
            "category": "interview",
            "aliases": [
                "Frontend Interview Preparation",
                "Front End Interview Handbook",
                "React Core Concepts and Interview Preparation",
            ],
            "prerequisites": ["coding-interview-preparation"],
        },
        {
            "id": "machine-learning-interview-preparation",
            "label": "Machine Learning Interview Preparation",
            "category": "interview",
            "aliases": ["ML Interview Preparation", "Machine Learning Engineering"],
            "prerequisites": ["coding-interview-preparation", "algorithms"],
        },
        {
            "id": "system-design-interview-preparation",
            "label": "System Design Interview Preparation",
            "category": "interview",
            "aliases": ["System Design Interviews", "System Design Interview Process", "System Design Interview Prep"],
            "prerequisites": ["system-design-fundamentals", "system-design"],
        },
        {
            "id": "system-design-clarification",
            "label": "System Design Clarification",
            "category": "interview",
            "aliases": [
                "System Design Clarification Questions",
                "System Design Interview Clarifying Questions",
            ],
            "prerequisites": ["system-design-fundamentals"],
        },
        {
            "id": "whiteboard-coding",
            "label": "Whiteboard Coding",
            "category": "interview",
            "aliases": [
                "Whiteboard Problem Solving",
                "Algorithm Design Canvas",
                "Coding Interview Canvas",
                "Interview Whiteboard Method",
            ],
            "prerequisites": ["coding-interview-preparation"],
        },
        {
            "id": "active-recall-and-spaced-repetition",
            "label": "Active Recall and Spaced Repetition",
            "category": "study",
            "aliases": [
                "Active Recall",
                "Spaced Repetition",
                "Anki Flashcard Conversion",
                "Computer Science Flash Cards",
                "Flashcard Study Strategy",
                "Flashcard-Based Study System",
                "Retaining Computer Science Knowledge",
                "Spaced Repetition Flashcards for CS & System Design",
            ],
            "prerequisites": [],
        },
    ],
}

CURRICULUM_BUCKETS = [
    {
        "id": "foundations-and-analysis",
        "label": "Foundations and Analysis",
        "summary": "Core programming, algorithmic thinking, study habits, and complexity analysis that underpin the rest of the curriculum.",
        "topic_ids": [
            "active-recall-and-spaced-repetition",
            "programming-fundamentals",
            "algorithms",
            "data-structures",
            "big-o-notation",
        ],
        "module_ids": ["setup-habits", "big-o", "leetcode-export-introduction"],
    },
    {
        "id": "linear-structures-and-patterns",
        "label": "Linear Structures and Patterns",
        "summary": "Sequential data structures and high-frequency interview patterns used on arrays, strings, lists, stacks, queues, hashes, and bits.",
        "topic_ids": [
            "arrays",
            "linked-lists",
            "two-pointers",
            "sliding-window",
            "stacks",
            "queues",
            "hash-tables",
            "bitwise-operations",
        ],
        "module_ids": [
            "arrays-linked-lists",
            "stacks-queues-hashes",
            "search-bitwise",
            "leetcode-export-arraystrings",
            "leetcode-export-hashing",
            "leetcode-export-linked-lists",
            "leetcode-export-stacks-and-queues",
            "leetcode-export-bonus",
        ],
    },
    {
        "id": "trees-search-and-ordering",
        "label": "Trees, Search, and Ordering",
        "summary": "Hierarchical structures together with search, sorting, and ordering techniques used to navigate and organize data efficiently.",
        "topic_ids": [
            "trees",
            "binary-search-trees",
            "balanced-search-trees",
            "heaps",
            "trie",
            "binary-search",
            "sorting-algorithms",
            "merge-sort",
            "divide-and-conquer",
        ],
        "module_ids": [
            "trees-heaps",
            "sorting",
            "search-bitwise",
            "leetcode-export-traversals-trees-graphs",
            "leetcode-export-heaps",
            "leetcode-export-binary-search",
            "leetcode-export-bonus",
        ],
    },
    {
        "id": "recursive-and-optimization-paradigms",
        "label": "Recursive and Optimization Paradigms",
        "summary": "Problem-solving paradigms that build solutions recursively, prune search, or optimize via state transitions and greedy decisions.",
        "topic_ids": [
            "recursion",
            "backtracking",
            "dynamic-programming",
            "greedy-algorithms",
        ],
        "module_ids": [
            "recursion-dp",
            "leetcode-export-greedy",
            "leetcode-export-backtracking",
            "leetcode-export-dynamic-programming",
        ],
    },
    {
        "id": "graph-algorithms-and-traversal",
        "label": "Graph Algorithms and Traversal",
        "summary": "Graph models, traversals, and path-finding techniques for reasoning about connectivity and network structure.",
        "topic_ids": ["graph-algorithms"],
        "module_ids": ["graphs", "leetcode-export-traversals-trees-graphs"],
    },
    {
        "id": "oop-and-architecture",
        "label": "Object-Oriented and Architecture Design",
        "summary": "Object-oriented design principles and architectural decomposition patterns used when moving from code to larger systems.",
        "topic_ids": [
            "object-oriented-programming",
            "object-oriented-design",
            "software-architecture",
        ],
        "module_ids": ["recursion-dp", "system-design", "supplemental-systems-concepts"],
    },
    {
        "id": "distributed-systems-and-platforms",
        "label": "Distributed Systems and Platforms",
        "summary": "Systems fundamentals spanning operating systems, networking, databases, distributed trade-offs, APIs, and platform infrastructure.",
        "topic_ids": [
            "operating-systems",
            "computer-networking",
            "internet-protocol",
            "ip-addressing-and-subnetting",
            "database-systems",
            "sql-joins",
            "distributed-systems",
            "concurrency",
            "cap-theorem",
            "api-design",
            "load-balancing",
            "caching-strategies",
            "consistent-hashing",
            "database-sharding",
            "cloud-computing",
            "microservices-architecture",
            "devops-and-deployment",
            "site-reliability-engineering",
        ],
        "module_ids": [
            "systems-basics",
            "system-design",
            "supplemental-systems-concepts",
            "supplemental-career",
        ],
    },
    {
        "id": "system-design-curriculum",
        "label": "System Design Curriculum",
        "summary": "The end-to-end system design interview curriculum, from fundamentals and clarifying questions to specialized front-end and interview workflows.",
        "topic_ids": [
            "system-design-fundamentals",
            "system-design",
            "front-end-system-design",
            "system-design-clarification",
            "system-design-interview-preparation",
        ],
        "module_ids": [
            "system-design",
            "supplemental-system-design-interviews",
            "supplemental-frontend-interviews",
        ],
    },
    {
        "id": "interview-preparation-and-career",
        "label": "Interview Preparation and Career Readiness",
        "summary": "Interview strategy, communication, role-specific preparation, and career artifacts needed to convert technical skill into job outcomes.",
        "topic_ids": [
            "coding-patterns",
            "competitive-programming",
            "coding-interview-preparation",
            "technical-interview-preparation",
            "behavioral-interview-preparation",
            "resume-writing",
            "salary-negotiation",
            "open-source-contribution",
            "front-end-interview-preparation",
            "machine-learning-interview-preparation",
            "whiteboard-coding",
        ],
        "module_ids": [
            "review-interview",
            "supplemental-interview-handbooks",
            "supplemental-behavioral-interviews",
            "supplemental-career",
            "supplemental-frontend-interviews",
            "supplemental-ml-interviews",
            "leetcode-export-interviews-and-tools",
        ],
    },
]

_TOPIC_FAMILY_OVERRIDES = {
    "active-recall-and-spaced-repetition": "study",
    "coding-patterns": "algorithmic",
    "competitive-programming": "algorithmic",
    "system-design-clarification": "interview",
    "system-design-interview-preparation": "interview",
}

_FAMILY_LESSON_PROFILES = {
    "algorithmic": {
        "family": "algorithmic",
        "allow_problem_items": True,
        "emphasis_sections": ["patterns", "pitfalls"],
        "practice_minimums": {
            "problem": 2,
            "exercise": 1,
            "total": 4,
        },
    },
    "systems": {
        "family": "systems",
        "allow_problem_items": False,
        "emphasis_sections": ["tradeoffs", "patterns", "pitfalls"],
        "practice_minimums": {
            "exercise": 2,
            "drill": 1,
            "total": 4,
        },
    },
    "design": {
        "family": "design",
        "allow_problem_items": False,
        "emphasis_sections": ["tradeoffs", "frameworks", "pitfalls"],
        "practice_minimums": {
            "exercise": 2,
            "drill": 1,
            "total": 4,
        },
    },
    "interview": {
        "family": "interview",
        "allow_problem_items": False,
        "emphasis_sections": ["frameworks", "pitfalls"],
        "practice_minimums": {
            "exercise": 1,
            "drill": 1,
            "checklist": 1,
            "total": 4,
        },
    },
    "career": {
        "family": "career",
        "allow_problem_items": False,
        "emphasis_sections": ["frameworks", "pitfalls"],
        "practice_minimums": {
            "exercise": 1,
            "drill": 1,
            "checklist": 1,
            "total": 4,
        },
    },
    "study": {
        "family": "study",
        "allow_problem_items": False,
        "emphasis_sections": ["frameworks", "pitfalls"],
        "practice_minimums": {
            "exercise": 2,
            "checklist": 1,
            "total": 4,
        },
    },
}


def _build_topic_bucket_lookup() -> dict[str, str]:
    lookup = {}
    for bucket in CURRICULUM_BUCKETS:
        for topic_id in bucket.get("topic_ids", []):
            lookup[topic_id] = bucket["id"]
    return lookup


_TOPIC_BUCKET_LOOKUP = _build_topic_bucket_lookup()


def _infer_topic_family(topic: dict) -> str:
    topic_id = topic["id"]
    if topic_id in _TOPIC_FAMILY_OVERRIDES:
        return _TOPIC_FAMILY_OVERRIDES[topic_id]

    bucket_id = _TOPIC_BUCKET_LOOKUP.get(topic_id)
    if bucket_id in {
        "foundations-and-analysis",
        "linear-structures-and-patterns",
        "trees-search-and-ordering",
        "recursive-and-optimization-paradigms",
        "graph-algorithms-and-traversal",
    }:
        return "algorithmic"
    if bucket_id == "distributed-systems-and-platforms":
        return "systems"
    if bucket_id == "oop-and-architecture":
        return "design"
    if bucket_id == "system-design-curriculum":
        return "design"

    category = topic.get("category")
    if category == "career":
        return "career"
    if category == "study":
        return "study"
    if category == "interview":
        return "interview"
    return "algorithmic"


def _apply_lesson_profiles() -> None:
    for topic in CURRICULUM_ONTOLOGY["topics"]:
        family = _infer_topic_family(topic)
        topic["lesson_profile"] = deepcopy(_FAMILY_LESSON_PROFILES[family])


_apply_lesson_profiles()
