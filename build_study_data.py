#!/usr/bin/env python3
"""Generate curriculum.json from a curated CIU study roadmap."""

from __future__ import annotations

import datetime
import json
from pathlib import Path

LEETCODE_EXPORT_DIR = Path(__file__).resolve().parent / "course_exports" / "leetcode-crash-course"

MODULES = [
    {
        "id": "setup-habits",
        "track": "dsa-leetcode",
        "title": "Setup: language, cadence, and problem practice",
        "phase": "Start Here",
        "estimate": "2-3 sessions",
        "sessions": 3,
        "summary": "Choose one language, pick a foundation book, and adopt the CIU habit of studying a topic and then immediately solving problems on it.",
        "items": [
            "Pick one interview language and use it consistently for implementations.",
            "Choose one primary book or course track for that language.",
            "Set a repeatable daily study block and implementation routine.",
            "Start spaced repetition for weak concepts instead of taking endless notes.",
            "After each new topic, do 2 or 3 interview problems before moving on.",
        ],
        "resources": [
            {"label": "Choose a Programming Language", "url": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#choose-a-programming-language"},
            {"label": "Programming Language Resources", "url": "https://github.com/jwasham/coding-interview-university/blob/master/programming-language-resources.md"},
            {"label": "Coding Interview Patterns", "url": "https://geni.us/q7svoz"},
            {"label": "Retaining Computer Science Knowledge", "url": "https://startupnextdoor.com/retaining-computer-science-knowledge/"},
            {"label": "CIU Flashcards Repo", "url": "https://github.com/jwasham/computer-science-flash-cards"},
        ],
        "checks": [
            "You can explain why you picked your language and where its trade-offs matter in interviews.",
            "You have a habit loop: learn, implement, solve a few problems, review later.",
        ],
        "sourceUrl": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#choose-a-programming-language",
    },
    {
        "id": "big-o",
        "track": "dsa-leetcode",
        "title": "Big-O and asymptotic analysis",
        "phase": "Core Track",
        "estimate": "2-4 sessions",
        "sessions": 4,
        "summary": "CIU treats Big-O as the language you use to discuss every later topic. Get comfortable with runtime, space, and amortized analysis first.",
        "items": [
            "Understand Big-O, Omega, and Theta at a practical interview level.",
            "Analyze loops, nested loops, and recursive structure without guessing.",
            "Learn amortized analysis for dynamic arrays and similar structures.",
            "Use the CTCI complexity chapter or quiz as a review checkpoint.",
        ],
        "resources": [
            {"label": "Harvard CS50 Asymptotic Notation", "url": "https://www.youtube.com/watch?v=iOq5kSKqeR4"},
            {"label": "Big O Notations Quick Tutorial", "url": "https://www.youtube.com/watch?v=V6mKVRU1evU"},
            {"label": "Big O Mathematical Explanation", "url": "https://www.youtube.com/watch?v=ei-A_wy5Yxw&index=2&list=PL1BaGV1cIH4UhkL8a9bJGG356covJ76qN"},
            {"label": "TopCoder Computational Complexity", "url": "https://www.topcoder.com/thrive/articles/Computational%20Complexity%20part%20one"},
            {"label": "Big-O Cheat Sheet", "url": "http://bigocheatsheet.com/"},
        ],
        "checks": [
            "You can state the time and space cost of every implementation you write.",
            "You can explain why an O(n log n) solution is meaningfully different from O(n^2) in interview settings.",
        ],
        "sourceUrl": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#algorithmic-complexity--big-o--asymptotic-analysis",
    },
    {
        "id": "arrays-linked-lists",
        "track": "dsa-leetcode",
        "title": "Linear structures: arrays and linked lists",
        "phase": "Core Track",
        "estimate": "6-8 sessions",
        "sessions": 8,
        "summary": "This is where CIU stops being abstract. Build the structures yourself so resizing, pointer movement, traversal, and memory behavior become concrete.",
        "items": [
            "Implement a dynamic array with resize, insert, delete, and search operations.",
            "Know the time and space trade-offs of contiguous storage versus pointer-heavy traversal.",
            "Implement a singly linked list with front and back operations, insert, erase, reverse, and remove by value.",
            "Understand pointer-to-pointer updates well enough to reason about list mutation safely.",
            "Do a few array and linked-list interview problems immediately after learning each structure.",
        ],
        "resources": [
            {"label": "Arrays CS50", "url": "https://www.youtube.com/watch?v=tI_tIZFyKBw&t=3009s"},
            {"label": "Dynamic Arrays", "url": "https://www.coursera.org/lecture/data-structures/dynamic-arrays-EwbnV"},
            {"label": "Linked Lists CS50", "url": "https://www.youtube.com/watch?v=2T-A_GFuoTo&t=650s"},
            {"label": "Linked Lists vs Arrays", "url": "https://www.coursera.org/lecture/data-structures-optimizing-performance/core-linked-lists-vs-arrays-rjBs9"},
            {"label": "Pointers to Pointers", "url": "https://www.eskimo.com/~scs/cclass/int/sx8.html"},
        ],
        "checks": [
            "You can implement a vector and linked list from memory in your chosen language.",
            "You can explain when linked lists are worse in practice despite theoretical advantages.",
        ],
        "sourceUrl": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#data-structures",
    },
    {
        "id": "stacks-queues-hashes",
        "track": "dsa-leetcode",
        "title": "Core DS II: stacks, queues, and hash tables",
        "phase": "Core Track",
        "estimate": "5-6 sessions",
        "sessions": 6,
        "summary": "These structures show up constantly in interview solutions. The goal is not just knowing them, but knowing what backs them and why the costs work out.",
        "items": [
            "Understand why stack implementation is trivial once arrays feel natural.",
            "Implement queue operations with both linked-list and fixed-array approaches.",
            "Understand why a bad linked-list queue implementation degrades to O(n).",
            "Implement a hash table with linear probing and key update semantics.",
            "Learn collisions, load factor, resizing, and why dictionaries feel fast in practice.",
        ],
        "resources": [
            {"label": "Stacks", "url": "https://www.coursera.org/lecture/data-structures/stacks-UdKzQ"},
            {"label": "Queues", "url": "https://www.coursera.org/lecture/data-structures/queues-EShpq"},
            {"label": "Circular Buffer", "url": "https://en.wikipedia.org/wiki/Circular_buffer"},
            {"label": "Hashing with Chaining", "url": "https://www.youtube.com/watch?v=0M_kIqhwbFo&list=PLUl4u3cNGP61Oq3tWYp6V_F-5jb5L2iHb&index=8"},
            {"label": "The Mighty Dictionary", "url": "https://www.youtube.com/watch?v=C4Kc8xzcA68"},
        ],
        "checks": [
            "You can choose between array-backed and list-backed queues based on constraints.",
            "You can explain the difference between chaining and open addressing without hand-waving.",
        ],
        "sourceUrl": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#data-structures",
    },
    {
        "id": "search-bitwise",
        "track": "dsa-leetcode",
        "title": "Binary search and bitwise operations",
        "phase": "Core Track",
        "estimate": "3-4 sessions",
        "sessions": 4,
        "summary": "CIU treats these as high-leverage interview tools: binary search for invariants and boundary handling, bitwise ops for compact reasoning and fast tricks.",
        "items": [
            "Implement binary search iteratively and recursively on sorted arrays.",
            "Practice left, right, and exact-match boundary variants until off-by-one bugs drop away.",
            "Learn bitwise operators, masks, shifts, complements, and powers of two.",
            "Practice counting set bits, swapping values, and absolute-value style bit tricks.",
        ],
        "resources": [
            {"label": "TopCoder Binary Search", "url": "https://www.topcoder.com/thrive/articles/Binary%20Search"},
            {"label": "LeetCode Binary Search Blueprint", "url": "https://leetcode.com/discuss/general-discussion/786126/python-powerful-ultimate-binary-search-template-solved-many-problems"},
            {"label": "Bits Cheat Sheet", "url": "https://github.com/jwasham/coding-interview-university/blob/main/extras/cheat%20sheets/bits-cheat-sheet.pdf"},
            {"label": "Bit Manipulation Intro", "url": "https://www.youtube.com/watch?v=7jkIUgLC29I"},
            {"label": "Stanford Bit Hacks", "url": "https://graphics.stanford.edu/~seander/bithacks.html"},
        ],
        "checks": [
            "You can describe the invariant your binary search maintains at every step.",
            "You can reason about masks, shifts, and two's complement instead of memorizing snippets.",
        ],
        "sourceUrl": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#more-knowledge",
    },
    {
        "id": "trees-heaps",
        "track": "dsa-leetcode",
        "title": "Trees, BSTs, and heaps",
        "phase": "Core Track",
        "estimate": "7-9 sessions",
        "sessions": 9,
        "summary": "This is one of the densest parts of CIU. Master traversals, BST mechanics, and heap operations well enough that tree problems stop feeling special.",
        "items": [
            "Learn BFS and DFS traversals for trees and know their space trade-offs.",
            "Implement BST insert, search, min/max, height, validation, delete, and successor.",
            "Understand level-order traversal and recursive traversals from memory.",
            "Implement a max-heap with insert, extract, heapify, and heap sort support.",
            "Know when balanced trees matter even if you do not implement AVL or red-black trees.",
        ],
        "resources": [
            {"label": "Intro to Trees", "url": "https://www.coursera.org/lecture/data-structures/trees-95qda"},
            {"label": "Tree Traversal", "url": "https://www.coursera.org/lecture/data-structures/tree-traversal-fr51b"},
            {"label": "Binary Search Tree Review", "url": "https://www.youtube.com/watch?v=x6At0nzX92o&index=1&list=PLA5Lqm4uh9Bbq-E0ZnqTIa8LRaL77ica6"},
            {"label": "MIT Binary Heaps", "url": "https://www.youtube.com/watch?v=Xnpo1atN-Iw&list=PLUl4u3cNGP63EdVPNLG3ToM6LaEUuStEY&index=12"},
            {"label": "Heap Review Playlist", "url": "https://www.youtube.com/playlist?list=PL9xmBV_5YoZNsyqgPW-DNwUeT8F8uhWc6"},
        ],
        "checks": [
            "You can code common tree traversals without looking them up.",
            "You can explain BST deletion cases and heap sift-up versus sift-down clearly.",
        ],
        "sourceUrl": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#trees",
    },
    {
        "id": "sorting",
        "track": "dsa-leetcode",
        "title": "Sorting as implementation and trade-off practice",
        "phase": "Core Track",
        "estimate": "4-5 sessions",
        "sessions": 5,
        "summary": "CIU uses sorting to force trade-off thinking: stability, in-place behavior, average versus worst-case runtime, and which data structures each algorithm suits.",
        "items": [
            "Know the best, average, and worst-case behavior of the major comparison sorts.",
            "Implement mergesort and quicksort from scratch.",
            "Understand stability and which sorts fit arrays versus linked lists.",
            "Tie heapsort back to heap operations instead of memorizing it separately.",
        ],
        "resources": [
            {"label": "Sedgewick Mergesort", "url": "https://www.coursera.org/learn/algorithms-part1/home/week/3"},
            {"label": "Sedgewick Quicksort", "url": "https://algs4.cs.princeton.edu/23quicksort/"},
            {"label": "Sorting in 18 Minutes", "url": "https://www.youtube.com/playlist?list=PL9xmBV_5YoZOZSbGAXAPIq1BeUf4j20pl"},
            {"label": "Visual Sort Comparison", "url": "https://www.youtube.com/watch?v=kPRA0W1kECg"},
            {"label": "Merge Sort for Linked List", "url": "http://www.geeksforgeeks.org/merge-sort-for-linked-list/"},
        ],
        "checks": [
            "You can explain why quicksort is often preferred despite its worst-case behavior.",
            "You can explain stability and give an example where it matters.",
        ],
        "sourceUrl": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#sorting",
    },
    {
        "id": "graphs",
        "track": "dsa-leetcode",
        "title": "Graphs as the final core algorithm block",
        "phase": "Core Track",
        "estimate": "7-9 sessions",
        "sessions": 9,
        "summary": "CIU explicitly calls this section long. Treat it as the capstone for the core track: representations, traversals, shortest paths, MSTs, and graph-specific interview patterns.",
        "items": [
            "Compare adjacency lists, matrices, maps, and pointer-based graph representations.",
            "Implement BFS and DFS across both list and matrix representations.",
            "Learn Dijkstra and minimum spanning tree well enough to explain the idea and complexity.",
            "Practice cycle detection, topological sort, connected components, SCCs, and bipartite checks.",
            "Train yourself to ask whether a problem is secretly a graph problem first.",
        ],
        "resources": [
            {"label": "MIT Breadth-First Search", "url": "https://www.youtube.com/watch?v=oFVYVzlvk9c&t=14s&ab_channel=MITOpenCourseWare"},
            {"label": "MIT Depth-First Search", "url": "https://www.youtube.com/watch?v=IBfWDYSffUU&t=32s&ab_channel=MITOpenCourseWare"},
            {"label": "Skiena Graph Data Structures", "url": "https://www.youtube.com/watch?v=Sjk0xqWWPCc&list=PLOtl7M3yp-DX6ic0HGT0PUX_wiNmkWkXx&index=10"},
            {"label": "Algorithms on Graphs", "url": "https://www.coursera.org/learn/algorithms-on-graphs/home/welcome"},
            {"label": "Shortest Path Review", "url": "https://www.youtube.com/playlist?list=PL9xmBV_5YoZO-Y-H3xIC9DGSfVYJng9Yw"},
        ],
        "checks": [
            "You can move between graph representations without getting lost.",
            "You can identify when BFS, DFS, Dijkstra, or MST is the relevant mental model.",
        ],
        "sourceUrl": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#graphs",
    },
    {
        "id": "recursion-dp",
        "track": "dsa-leetcode",
        "title": "Recursion, backtracking, and dynamic programming",
        "phase": "Deepen",
        "estimate": "5-7 sessions",
        "sessions": 7,
        "summary": "CIU treats this as pattern recognition, not brute-force memorization. The goal is to know when recursion or DP is the right framing and how to reason about subproblems.",
        "items": [
            "Practice recursion until you can trace call stacks and base cases comfortably.",
            "Use backtracking patterns for subsets, permutations, and search-style problems.",
            "Learn when a problem is a dynamic-programming candidate.",
            "Work through examples that force you to define the recurrence and state.",
            "Review a light set of design patterns rather than turning this into a deep OO detour.",
        ],
        "resources": [
            {"label": "Stanford Recursion Lectures", "url": "https://www.youtube.com/watch?v=gl3emqCuueQ&list=PLFE6E58F856038C69&index=8"},
            {"label": "5 Steps for Recursive Problems", "url": "https://youtu.be/ngCos392W4w"},
            {"label": "Skiena Dynamic Programming Intro", "url": "https://www.youtube.com/watch?v=wAA0AMfcJHQ&list=PLOtl7M3yp-DX6ic0HGT0PUX_wiNmkWkXx&index=18"},
            {"label": "DP Problem Playlist", "url": "https://www.youtube.com/playlist?list=PLrmLmBdmIlpsHaNTPP_jHHDx_os9ItYXr"},
            {"label": "Head First Design Patterns", "url": "https://www.amazon.com/Head-First-Design-Patterns-Freeman/dp/0596007124"},
        ],
        "checks": [
            "You can tell the difference between brute-force recursion, backtracking, and DP.",
            "You can explain a DP state and transition instead of only remembering a final formula.",
        ],
        "sourceUrl": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#even-more-knowledge",
    },
    {
        "id": "systems-basics",
        "track": "dsa-leetcode",
        "title": "Systems basics that frequently leak into interviews",
        "phase": "Deepen",
        "estimate": "5-6 sessions",
        "sessions": 6,
        "summary": "CIU includes a broad set of systems topics because interviews regularly touch the edges of OS, hardware, testing, and networking even when the main question is algorithmic.",
        "items": [
            "Learn how a program is executed at a CPU, register, memory, and instruction level.",
            "Understand cache behavior well enough to explain why locality matters and how LRU works.",
            "Review processes, threads, locks, deadlock, context switching, and virtual memory.",
            "Cover unit tests, mocks, integration tests, and dependency injection at a practical level.",
            "Get a functional understanding of HTTP, TCP versus UDP, TLS, and sockets.",
        ],
        "resources": [
            {"label": "How CPU Executes a Program", "url": "https://www.youtube.com/watch?v=XM4lGflQFvA"},
            {"label": "MIT Memory Hierarchy", "url": "https://www.youtube.com/watch?v=vjYF_fAZI5E&list=PLrRW1w6CGAcXbMtDFj205vALOGmiRc82-&index=24"},
            {"label": "Operating Systems and System Programming", "url": "https://archive.org/details/ucberkeley-webcast-PL-XXv-cvA_iBDyz-ba4yDskqMDY6A1w_c"},
            {"label": "Agile Software Testing", "url": "https://www.youtube.com/watch?v=SAhJf36_u5U"},
            {"label": "Khan Academy Computers and the Internet", "url": "https://www.khanacademy.org/computing/code-org/computers-and-the-internet"},
        ],
        "checks": [
            "You can answer follow-up questions about caches, threads, or networking without freezing.",
            "You can connect performance issues back to memory, concurrency, or I/O behavior.",
        ],
        "sourceUrl": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#even-more-knowledge",
    },
    {
        "id": "review-interview",
        "track": "resume-behavioral",
        "title": "Final review and interview loop",
        "phase": "Interview Loop",
        "estimate": "4-5 sessions",
        "sessions": 5,
        "summary": "The README does not stop at topics. It tells you to tighten recall, clean up your resume, prepare stories, and run mocks so the technical work translates into offers.",
        "items": [
            "Use short review playlists to keep earlier topics fresh.",
            "Turn study and project work into clear, outcome-focused resume bullets.",
            "Read interview-process material and schedule mock interviews.",
            "Prepare stories for challenge, impact, bugs, trade-offs, and teamwork.",
            "Prepare thoughtful questions for the interviewer before each loop.",
        ],
        "resources": [
            {"label": "Final Review Playlist", "url": "https://www.youtube.com/watch?v=r4r1DZcx1cM&list=PLmVb1OknmNJuC5POdcDv5oCS7_OUkDgpj&index=22"},
            {"label": "Tech Interview Handbook Resume Guide", "url": "https://www.techinterviewhandbook.org/resume/guide"},
            {"label": "How to Pass the Engineering Interview", "url": "https://davidbyttow.medium.com/how-to-pass-the-engineering-interview-in-2021-45f1b389a1"},
            {"label": "Pramp Mock Interviews", "url": "https://www.pramp.com/"},
            {"label": "Interviewing.io", "url": "https://interviewing.io"},
        ],
        "checks": [
            "You can explain your projects and study work with structure, not rambling detail.",
            "You have both technical and behavioral practice in your calendar before applying widely.",
        ],
        "sourceUrl": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#final-review",
    },
    {
        "id": "system-design",
        "track": "system-design",
        "title": "Optional: system design and scalability",
        "phase": "Optional Advanced",
        "estimate": "Only if needed",
        "sessions": 8,
        "summary": "CIU explicitly says this is for 4+ years of experience. Keep it out of the core plan unless the roles you want actually require system design rounds.",
        "items": [
            "Skip this module entirely for entry-level prep unless your target role clearly expects it.",
            "Start with the System Design Primer and the HiredInTech process explanation.",
            "Practice framing constraints, load, storage, trade-offs, and bottlenecks on paper.",
            "Study a few real-world architectures instead of trying to absorb the entire appendix.",
        ],
        "resources": [
            {"label": "The System Design Primer", "url": "https://github.com/donnemartin/system-design-primer"},
            {"label": "System Design from HiredInTech", "url": "http://www.hiredintech.com/system-design/"},
            {"label": "8 Steps Guide to System Design", "url": "https://javascript.plainenglish.io/8-steps-guide-to-ace-a-system-design-interview-7a5a797f4d7d"},
            {"label": "CIU System Design Cheat Sheet", "url": "https://github.com/jwasham/coding-interview-university/blob/main/extras/cheat%20sheets/system-design.pdf"},
            {"label": "MIT 6.824 Distributed Systems", "url": "https://www.youtube.com/watch?v=cQP8WApzIQQ&list=PLrw6a1wE39_tb2fErI4-WkMbsvGQk9_UB"},
        ],
        "checks": [
            "You can scope a design question before jumping into components.",
            "You can talk through trade-offs instead of listing infrastructure buzzwords.",
        ],
        "sourceUrl": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#system-design-scalability-data-handling",
    },
]


PIPELINE_ONLY_MODULES = [
    {
        "id": "supplemental-interview-handbooks",
        "title": "Supplemental: interview handbooks and coding patterns",
        "phase": "Supplemental",
        "estimate": "Pipeline only",
        "sessions": 0,
        "summary": "Additional general interview-prep repositories used only to enrich scraped concepts, summaries, and practice prompts.",
        "items": [],
        "resources": [
            {"label": "nas5w Interview Guide", "url": "https://github.com/nas5w/interview-guide"},
            {"label": "Yangshun Tech Interview Handbook", "url": "https://github.com/yangshun/tech-interview-handbook"},
            {"label": "kdn251 Interviews", "url": "https://github.com/kdn251/interviews"},
            {
                "label": "Chanda Abdul Coding Patterns",
                "url": "https://github.com/Chanda-Abdul/Several-Coding-Patterns-for-Solving-Data-Structures-and-Algorithms-Problems-during-Interviews",
            },
        ],
        "checks": [],
        "sourceUrl": "https://github.com/yangshun/tech-interview-handbook",
    },
    {
        "id": "supplemental-frontend-interviews",
        "title": "Supplemental: front-end interview repositories",
        "phase": "Supplemental",
        "estimate": "Pipeline only",
        "sessions": 0,
        "summary": "Front-end focused interview repositories used for additional scraping coverage and concept extraction.",
        "items": [],
        "resources": [
            {"label": "Sudheer ReactJS Interview Questions", "url": "https://github.com/sudheerj/reactjs-interview-questions"},
            {"label": "Yangshun Front End Interview Handbook", "url": "https://github.com/yangshun/front-end-interview-handbook"},
        ],
        "checks": [],
        "sourceUrl": "https://github.com/yangshun/front-end-interview-handbook",
    },
    {
        "id": "supplemental-system-design-interviews",
        "title": "Supplemental: system design repositories",
        "phase": "Supplemental",
        "estimate": "Pipeline only",
        "sessions": 0,
        "summary": "Additional system design repositories used to enrich optional advanced scraping output.",
        "items": [],
        "resources": [
            {"label": "Karan Pratap Singh System Design", "url": "https://github.com/karanpratapsingh/system-design"},
            {"label": "Shashank88 System Design", "url": "https://github.com/shashank88/system_design"},
        ],
        "checks": [],
        "sourceUrl": "https://github.com/karanpratapsingh/system-design",
    },
    {
        "id": "supplemental-ml-interviews",
        "title": "Supplemental: machine learning interview repositories",
        "phase": "Supplemental",
        "estimate": "Pipeline only",
        "sessions": 0,
        "summary": "Machine-learning interview repositories used as specialty scraping sources outside the main CIU roadmap.",
        "items": [],
        "resources": [
            {"label": "khangich Machine Learning Interview", "url": "https://github.com/khangich/machine-learning-interview"},
            {"label": "Alireza Dir Machine Learning Interviews", "url": "https://github.com/alirezadir/Machine-Learning-Interviews"},
        ],
        "checks": [],
        "sourceUrl": "https://github.com/khangich/machine-learning-interview",
    },
    {
        "id": "supplemental-behavioral-interviews",
        "title": "Supplemental: behavioral interview repositories",
        "phase": "Supplemental",
        "estimate": "Pipeline only",
        "sessions": 0,
        "summary": "Behavioral interview repositories used to improve non-technical interview preparation coverage in the pipeline.",
        "items": [],
        "resources": [
            {
                "label": "Ashish PS1 Awesome Behavioral Interviews",
                "url": "https://github.com/ashishps1/awesome-behavioral-interviews",
            },
        ],
        "checks": [],
        "sourceUrl": "https://github.com/ashishps1/awesome-behavioral-interviews",
    },
    {
        "id": "supplemental-dsa-references",
        "title": "Supplemental: core DSA reference articles",
        "phase": "Supplemental",
        "estimate": "Pipeline only",
        "sessions": 0,
        "summary": "Wikipedia reference articles for core data structures and algorithms topics that lack freely-scrapeable primary sources due to Coursera paywalls.",
        "items": [],
        "resources": [
            {"label": "Arrays", "url": "https://en.wikipedia.org/wiki/Array_(data_structure)"},
            {"label": "Hash Table", "url": "https://en.wikipedia.org/wiki/Hash_table"},
            {"label": "Tree Data Structure", "url": "https://en.wikipedia.org/wiki/Tree_(data_structure)"},
            {"label": "Heap Data Structure", "url": "https://en.wikipedia.org/wiki/Heap_(data_structure)"},
            {"label": "Graph Traversal", "url": "https://en.wikipedia.org/wiki/Graph_traversal"},
            {"label": "Dynamic Programming", "url": "https://en.wikipedia.org/wiki/Dynamic_programming"},
            {"label": "Greedy Algorithm", "url": "https://en.wikipedia.org/wiki/Greedy_algorithm"},
            {"label": "Divide and Conquer Algorithm", "url": "https://en.wikipedia.org/wiki/Divide-and-conquer_algorithm"},
            {"label": "Object-Oriented Programming", "url": "https://en.wikipedia.org/wiki/Object-oriented_programming"},
            {"label": "Object-Oriented Design", "url": "https://en.wikipedia.org/wiki/Object-oriented_design"},
            # GFG single-topic articles (NOT category hub pages — those trigger multi-page crawls)
            {"label": "Recursion Algorithms", "url": "https://www.geeksforgeeks.org/recursion/"},
            # Wikipedia focused articles for backtracking (GFG /backtracking-algorithms/ is a category hub)
            {"label": "Backtracking", "url": "https://en.wikipedia.org/wiki/Backtracking"},
            # FreeCodeCamp articles for topics whose GFG/Wikipedia content still got absorbed
            {"label": "Sorting Algorithms Explained", "url": "https://www.freecodecamp.org/news/sorting-algorithms-explained/"},
            {"label": "Dynamic Programming Explained", "url": "https://www.freecodecamp.org/news/demystifying-dynamic-programming-3efafb8d4296/"},
            # Programiz topic pages reinforce general algorithm paradigms without category crawls.
            {"label": "Greedy Algorithm (Programiz)", "url": "https://www.programiz.com/dsa/greedy-algorithm"},
            {"label": "Divide and Conquer Algorithm (Programiz)", "url": "https://www.programiz.com/dsa/divide-and-conquer"},
        ],
        "checks": [],
        "sourceUrl": "https://en.wikipedia.org/wiki/List_of_data_structures",
    },
    {
        "id": "supplemental-systems-concepts",
        "title": "Supplemental: systems and design concept references",
        "phase": "Supplemental",
        "estimate": "Pipeline only",
        "sessions": 0,
        "summary": "Wikipedia and article references for system design, distributed systems, and software architecture concepts with no dedicated primary source in the main modules.",
        "items": [],
        "resources": [
            {"label": "Database Systems", "url": "https://en.wikipedia.org/wiki/Database"},
            {"label": "Distributed Computing", "url": "https://en.wikipedia.org/wiki/Distributed_computing"},
            {"label": "Concurrency in Computing", "url": "https://en.wikipedia.org/wiki/Concurrency_(computer_science)"},
            {"label": "Cache Replacement Policies", "url": "https://en.wikipedia.org/wiki/Cache_replacement_policies"},
            {"label": "Load Balancing", "url": "https://en.wikipedia.org/wiki/Load_balancing_(computing)"},
            {"label": "API Design", "url": "https://en.wikipedia.org/wiki/API"},
            {"label": "CAP Theorem", "url": "https://en.wikipedia.org/wiki/CAP_theorem"},
            {"label": "Consistent Hashing", "url": "https://en.wikipedia.org/wiki/Consistent_hashing"},
            {"label": "Database Sharding", "url": "https://en.wikipedia.org/wiki/Shard_(database_architecture)"},
            {"label": "Cloud Computing", "url": "https://en.wikipedia.org/wiki/Cloud_computing"},
            {"label": "Microservices Architecture", "url": "https://en.wikipedia.org/wiki/Microservices"},
            # GFG for software architecture (Wikipedia got distributed into design-pattern clusters)
            {"label": "Software Architecture and Design", "url": "https://www.geeksforgeeks.org/software-architecture-and-design/"},
            # Computer Networking basics (no source existed for this node)
            {"label": "Computer Network", "url": "https://en.wikipedia.org/wiki/Computer_network"},
        ],
        "checks": [],
        "sourceUrl": "https://en.wikipedia.org/wiki/Distributed_computing",
    },
    {
        "id": "supplemental-career",
        "title": "Supplemental: career and SRE resources",
        "phase": "Supplemental",
        "estimate": "Pipeline only",
        "sessions": 0,
        "summary": "Career-focused references for salary negotiation, resume writing, and site reliability engineering — topics in the curriculum ontology with no primary source coverage.",
        "items": [],
        "resources": [
            {"label": "Site Reliability Engineering", "url": "https://en.wikipedia.org/wiki/Site_reliability_engineering"},
            {"label": "Salary Negotiation for Software Engineers", "url": "https://www.kalzumeus.com/2012/01/23/salary-negotiation/"},
            # Different URL from the review-interview module's handbook guide to avoid dedup
            {"label": "Software Engineer Resume Writing", "url": "https://www.freecodecamp.org/news/writing-a-killer-software-engineering-resume-b11c91ef699d/"},
        ],
        "checks": [],
        "sourceUrl": "https://www.kalzumeus.com/2012/01/23/salary-negotiation/",
    },
]

LEETCODE_CHAPTER_SELECTION = {
    "arraystrings",
    "hashing",
    "linked-lists",
    "stacks-and-queues",
    "traversals-trees-graphs",
    "heaps",
    "greedy",
    "binary-search",
    "backtracking",
    "dynamic-programming",
}

LEETCODE_PIPELINE_SKIP_TITLES = {"Testimonials"}


def leetcode_chapter_url(course_slug: str, chapter_id: str | int, chapter_slug: str) -> str:
    return (
        "https://leetcode.com/explore/interview/card/"
        f"{course_slug}/{chapter_id}/{chapter_slug}/"
    )


def leetcode_item_url(course_slug: str, chapter_id: str | int, chapter_slug: str, item_id: str | int) -> str:
    return leetcode_chapter_url(course_slug, chapter_id, chapter_slug) + f"{item_id}/"


def _leetcode_module_id(chapter_slug: str) -> str:
    return f"leetcode-course-{chapter_slug}"


def _leetcode_module_title(chapter_title: str) -> str:
    return f"LeetCode Crash Course: {chapter_title}"


def _leetcode_estimate(item_count: int) -> tuple[str, int]:
    sessions = max(2, (item_count + 4) // 5)
    return f"{sessions} sessions", sessions


def _leetcode_item_prefix(item: dict) -> str:
    if item.get("question"):
        return "Solve"
    return "Study"


def load_leetcode_course_modules(export_dir: Path = LEETCODE_EXPORT_DIR) -> list[dict]:
    manifest_path = export_dir / "manifest.json"
    if not manifest_path.exists():
        return []

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    course_slug = str(manifest.get("courseSlug") or "").strip()
    if not course_slug:
        return []

    modules = []
    for chapter_entry in manifest.get("chapters", []):
        chapter_slug = str(chapter_entry.get("slug") or "").strip()
        if chapter_slug not in LEETCODE_CHAPTER_SELECTION:
            continue

        chapter_path = export_dir / chapter_entry["path"]
        if not chapter_path.exists():
            continue

        chapter_payload = json.loads(chapter_path.read_text(encoding="utf-8"))
        chapter = chapter_payload.get("chapter", {})
        chapter_id = chapter.get("id")
        chapter_title = str(chapter.get("title") or chapter_slug).strip()
        chapter_description = str(chapter.get("descriptionText") or "").strip()
        chapter_items = list(chapter.get("items") or [])
        estimate, sessions = _leetcode_estimate(len(chapter_items))
        chapter_url = leetcode_chapter_url(course_slug, chapter_id, chapter_slug)

        items = [
            f"{_leetcode_item_prefix(item)}: {item.get('title', 'Untitled item')}"
            for item in chapter_items
        ]
        resources = [{"label": "Open chapter on LeetCode", "url": chapter_url}]
        for item in chapter_items:
            item_id = item.get("id")
            item_title = str(item.get("title") or "Untitled item").strip()
            prefix = "Problem" if item.get("question") else "Lesson"
            resources.append(
                {
                    "label": f"{prefix}: {item_title}",
                    "url": leetcode_item_url(course_slug, chapter_id, chapter_slug, item_id),
                }
            )

        modules.append(
            {
                "id": _leetcode_module_id(chapter_slug),
                "track": "dsa-leetcode",
                "title": _leetcode_module_title(chapter_title),
                "phase": "LeetCode Course",
                "countsTowardSchedule": False,
                "estimate": estimate,
                "sessions": sessions,
                "summary": (
                    f"{chapter_description} Imported from the purchased LeetCode crash course "
                    f"with {len(chapter_items)} lessons and exercises."
                ),
                "items": items,
                "resources": resources,
                "checks": [
                    f"You worked through the {chapter_title.lower()} lessons and attempted the practice problems.",
                    "You can explain the chapter's main patterns before looking at the walkthrough again.",
                ],
                "sourceUrl": chapter_url,
            }
        )

    return modules


def load_dynamic_pipeline_only_modules(export_dir: Path = LEETCODE_EXPORT_DIR) -> list[dict]:
    manifest_path = export_dir / "manifest.json"
    if not manifest_path.exists():
        return []

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    course_slug = str(manifest.get("courseSlug") or "").strip()
    if not course_slug:
        return []

    modules = []
    for chapter_entry in manifest.get("chapters", []):
        chapter_path = export_dir / chapter_entry["path"]
        if not chapter_path.exists():
            continue

        chapter_payload = json.loads(chapter_path.read_text(encoding="utf-8"))
        chapter = chapter_payload.get("chapter", {})
        chapter_id = chapter.get("id")
        chapter_slug = str(chapter.get("slug") or chapter_entry.get("slug") or "").strip()
        chapter_title = str(chapter.get("title") or chapter_slug).strip()
        chapter_description = str(chapter.get("descriptionText") or "").strip()

        resources = []
        for item_entry in chapter_payload.get("items", []):
            item_title = str(item_entry.get("title") or "").strip()
            if not item_title or item_title in LEETCODE_PIPELINE_SKIP_TITLES:
                continue
            if item_entry.get("status") != "ok" or int(item_entry.get("textLength") or 0) <= 0:
                continue

            item_path = export_dir / item_entry["path"]
            if not item_path.exists():
                continue

            item_id = item_entry.get("id")
            resources.append(
                {
                    "label": item_title,
                    "url": leetcode_item_url(course_slug, chapter_id, chapter_slug, item_id),
                    "sourcePath": str(item_path),
                }
            )

        if not resources:
            continue

        modules.append(
            {
                "id": f"leetcode-export-{chapter_slug}",
                "title": _leetcode_module_title(chapter_title),
                "phase": "Supplemental",
                "estimate": "Pipeline only",
                "sessions": 0,
                "summary": (
                    f"{chapter_description} Imported from the local LeetCode export for topic synthesis."
                ),
                "items": [],
                "resources": resources,
                "checks": [],
                "sourceUrl": leetcode_chapter_url(course_slug, chapter_id, chapter_slug),
            }
        )

    return modules


MODULES.extend(load_leetcode_course_modules())

CURRICULUM_JSON_VERSION = 1
CURRICULUM_JSON_OUTPUT = Path(__file__).resolve().parent / "curriculum.json"
KNOWLEDGE_BASE_PATH = Path(__file__).resolve().parent / "knowledge-base.json"

TRACKS = [
    {"id": "dsa-leetcode", "label": "DSA & LeetCode"},
    {"id": "system-design", "label": "System Design"},
    {"id": "machine-learning", "label": "Machine Learning"},
    {"id": "resume-behavioral", "label": "Resume & Behavioral"},
]


def _curriculum_items(module: dict) -> list[dict]:
    mid = module["id"]
    items = []
    for i, r in enumerate(module.get("resources", [])):
        items.append({"id": f"{mid}:read:{i}", "type": "read",
                      "label": r["label"], "url": r["url"]})
    for i, text in enumerate(module.get("items", [])):
        items.append({"id": f"{mid}:do:{i}", "type": "do",
                      "label": text, "url": None})
    for i, text in enumerate(module.get("checks", [])):
        items.append({"id": f"{mid}:check:{i}", "type": "check",
                      "label": text, "url": None})
    return items


def _compute_prereq_module_ids(modules: list[dict]) -> dict[str, list[str]]:
    if not KNOWLEDGE_BASE_PATH.exists():
        return {m["id"]: [] for m in modules}

    kb = json.loads(KNOWLEDGE_BASE_PATH.read_text(encoding="utf-8"))
    planning_topics = kb.get("planning_topics", [])
    planning_edges = kb.get("planning_topic_edges", [])

    topic_to_modules: dict[str, set[str]] = {}
    for pt in planning_topics:
        tid = pt.get("planning_topic_id") or pt.get("id", "")
        topic_to_modules[tid] = set(pt.get("module_ids", []))

    prereq_edges: list[tuple[str, str]] = []
    for edge in planning_edges:
        if edge.get("type") == "prerequisite":
            from_id = edge.get("from", "").replace("planning:", "")
            to_id = edge.get("to", "").replace("planning:", "")
            if from_id and to_id:
                prereq_edges.append((from_id, to_id))

    module_ids = {m["id"] for m in modules}
    module_order = {m["id"]: index for index, m in enumerate(modules)}
    module_track = {m["id"]: m.get("track", "dsa-leetcode") for m in modules}
    result: dict[str, list[str]] = {m["id"]: [] for m in modules}

    for module in modules:
        mid = module["id"]
        topics_for_module = {
            tid for tid, mids in topic_to_modules.items() if mid in mids
        }
        prereq_topic_ids: set[str] = set()
        for tid in topics_for_module:
            for (from_id, to_id) in prereq_edges:
                if to_id == tid:
                    prereq_topic_ids.add(from_id)

        prereq_module_ids: set[str] = set()
        for ptid in prereq_topic_ids:
            for module_id in topic_to_modules.get(ptid, set()):
                if module_id in module_ids and module_id != mid:
                    prereq_module_ids.add(module_id)

        # Keep prerequisites actionable for the learner-facing linear roadmap:
        # - same track only (cross-track references create noisy guidance)
        # - backward edges only (avoid forward refs/cycles in module metadata)
        filtered_prereq_ids = [
            module_id
            for module_id in prereq_module_ids
            if module_track.get(module_id) == module_track.get(mid)
            and module_order.get(module_id, -1) < module_order.get(mid, -1)
        ]
        filtered_prereq_ids.sort(key=lambda module_id: module_order[module_id])
        result[mid] = filtered_prereq_ids

    return result


def build_curriculum_json() -> None:
    prereqs = _compute_prereq_module_ids(MODULES)
    curriculum = {
        "version": CURRICULUM_JSON_VERSION,
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "tracks": TRACKS,
        "modules": [
            {
                "id": m["id"],
                "title": m["title"],
                "track": m.get("track", "dsa-leetcode"),
                "phase": m["phase"],
                "summary": m.get("summary", ""),
                "estimate": m.get("estimate", ""),
                "sessions": m.get("sessions", 0),
                "countsTowardSchedule": m.get("countsTowardSchedule", True),
                "sourceUrl": m.get("sourceUrl", ""),
                "items": _curriculum_items(m),
                "prerequisiteModuleIds": prereqs.get(m["id"], []),
            }
            for m in MODULES
        ],
    }
    CURRICULUM_JSON_OUTPUT.write_text(
        json.dumps(curriculum, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote curriculum.json with {len(curriculum['modules'])} modules.")


def build_payload() -> dict:
    """Compatibility helper for tests that still assert on the public module set."""
    total_items = sum(len(module["items"]) for module in MODULES)
    total_sessions = sum(
        module["sessions"]
        for module in MODULES
        if module.get("countsTowardSchedule", True)
    )

    return {
        "title": "Coding Interview University Study Guide",
        "source": "README.md",
        "totalItems": total_items,
        "totalSessions": total_sessions,
        "sections": MODULES,
    }


def main() -> None:
    build_curriculum_json()


if __name__ == "__main__":
    main()
