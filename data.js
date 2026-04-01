window.STUDY_GUIDE_DATA = {
  "title": "Coding Interview University Study Guide",
  "source": "README.md",
  "totalItems": 185,
  "totalSessions": 66,
  "sections": [
    {
      "id": "setup-habits",
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
        "After each new topic, do 2 or 3 interview problems before moving on."
      ],
      "resources": [
        {
          "label": "Choose a Programming Language",
          "url": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#choose-a-programming-language"
        },
        {
          "label": "Programming Language Resources",
          "url": "https://github.com/jwasham/coding-interview-university/blob/master/programming-language-resources.md"
        },
        {
          "label": "Coding Interview Patterns",
          "url": "https://geni.us/q7svoz"
        },
        {
          "label": "Retaining Computer Science Knowledge",
          "url": "https://startupnextdoor.com/retaining-computer-science-knowledge/"
        },
        {
          "label": "CIU Flashcards Repo",
          "url": "https://github.com/jwasham/computer-science-flash-cards"
        }
      ],
      "checks": [
        "You can explain why you picked your language and where its trade-offs matter in interviews.",
        "You have a habit loop: learn, implement, solve a few problems, review later."
      ],
      "sourceUrl": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#choose-a-programming-language"
    },
    {
      "id": "big-o",
      "title": "Big-O and asymptotic analysis",
      "phase": "Core Track",
      "estimate": "2-4 sessions",
      "sessions": 4,
      "summary": "CIU treats Big-O as the language you use to discuss every later topic. Get comfortable with runtime, space, and amortized analysis first.",
      "items": [
        "Understand Big-O, Omega, and Theta at a practical interview level.",
        "Analyze loops, nested loops, and recursive structure without guessing.",
        "Learn amortized analysis for dynamic arrays and similar structures.",
        "Use the CTCI complexity chapter or quiz as a review checkpoint."
      ],
      "resources": [
        {
          "label": "Harvard CS50 Asymptotic Notation",
          "url": "https://www.youtube.com/watch?v=iOq5kSKqeR4"
        },
        {
          "label": "Big O Notations Quick Tutorial",
          "url": "https://www.youtube.com/watch?v=V6mKVRU1evU"
        },
        {
          "label": "Big O Mathematical Explanation",
          "url": "https://www.youtube.com/watch?v=ei-A_wy5Yxw&index=2&list=PL1BaGV1cIH4UhkL8a9bJGG356covJ76qN"
        },
        {
          "label": "TopCoder Computational Complexity",
          "url": "https://www.topcoder.com/thrive/articles/Computational%20Complexity%20part%20one"
        },
        {
          "label": "Big-O Cheat Sheet",
          "url": "http://bigocheatsheet.com/"
        }
      ],
      "checks": [
        "You can state the time and space cost of every implementation you write.",
        "You can explain why an O(n log n) solution is meaningfully different from O(n^2) in interview settings."
      ],
      "sourceUrl": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#algorithmic-complexity--big-o--asymptotic-analysis"
    },
    {
      "id": "arrays-linked-lists",
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
        "Do a few array and linked-list interview problems immediately after learning each structure."
      ],
      "resources": [
        {
          "label": "Arrays CS50",
          "url": "https://www.youtube.com/watch?v=tI_tIZFyKBw&t=3009s"
        },
        {
          "label": "Dynamic Arrays",
          "url": "https://www.coursera.org/lecture/data-structures/dynamic-arrays-EwbnV"
        },
        {
          "label": "Linked Lists CS50",
          "url": "https://www.youtube.com/watch?v=2T-A_GFuoTo&t=650s"
        },
        {
          "label": "Linked Lists vs Arrays",
          "url": "https://www.coursera.org/lecture/data-structures-optimizing-performance/core-linked-lists-vs-arrays-rjBs9"
        },
        {
          "label": "Pointers to Pointers",
          "url": "https://www.eskimo.com/~scs/cclass/int/sx8.html"
        }
      ],
      "checks": [
        "You can implement a vector and linked list from memory in your chosen language.",
        "You can explain when linked lists are worse in practice despite theoretical advantages."
      ],
      "sourceUrl": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#data-structures"
    },
    {
      "id": "stacks-queues-hashes",
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
        "Learn collisions, load factor, resizing, and why dictionaries feel fast in practice."
      ],
      "resources": [
        {
          "label": "Stacks",
          "url": "https://www.coursera.org/lecture/data-structures/stacks-UdKzQ"
        },
        {
          "label": "Queues",
          "url": "https://www.coursera.org/lecture/data-structures/queues-EShpq"
        },
        {
          "label": "Circular Buffer",
          "url": "https://en.wikipedia.org/wiki/Circular_buffer"
        },
        {
          "label": "Hashing with Chaining",
          "url": "https://www.youtube.com/watch?v=0M_kIqhwbFo&list=PLUl4u3cNGP61Oq3tWYp6V_F-5jb5L2iHb&index=8"
        },
        {
          "label": "The Mighty Dictionary",
          "url": "https://www.youtube.com/watch?v=C4Kc8xzcA68"
        }
      ],
      "checks": [
        "You can choose between array-backed and list-backed queues based on constraints.",
        "You can explain the difference between chaining and open addressing without hand-waving."
      ],
      "sourceUrl": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#data-structures"
    },
    {
      "id": "search-bitwise",
      "title": "Binary search and bitwise operations",
      "phase": "Core Track",
      "estimate": "3-4 sessions",
      "sessions": 4,
      "summary": "CIU treats these as high-leverage interview tools: binary search for invariants and boundary handling, bitwise ops for compact reasoning and fast tricks.",
      "items": [
        "Implement binary search iteratively and recursively on sorted arrays.",
        "Practice left, right, and exact-match boundary variants until off-by-one bugs drop away.",
        "Learn bitwise operators, masks, shifts, complements, and powers of two.",
        "Practice counting set bits, swapping values, and absolute-value style bit tricks."
      ],
      "resources": [
        {
          "label": "TopCoder Binary Search",
          "url": "https://www.topcoder.com/thrive/articles/Binary%20Search"
        },
        {
          "label": "LeetCode Binary Search Blueprint",
          "url": "https://leetcode.com/discuss/general-discussion/786126/python-powerful-ultimate-binary-search-template-solved-many-problems"
        },
        {
          "label": "Bits Cheat Sheet",
          "url": "https://github.com/jwasham/coding-interview-university/blob/main/extras/cheat%20sheets/bits-cheat-sheet.pdf"
        },
        {
          "label": "Bit Manipulation Intro",
          "url": "https://www.youtube.com/watch?v=7jkIUgLC29I"
        },
        {
          "label": "Stanford Bit Hacks",
          "url": "https://graphics.stanford.edu/~seander/bithacks.html"
        }
      ],
      "checks": [
        "You can describe the invariant your binary search maintains at every step.",
        "You can reason about masks, shifts, and two's complement instead of memorizing snippets."
      ],
      "sourceUrl": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#more-knowledge"
    },
    {
      "id": "trees-heaps",
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
        "Know when balanced trees matter even if you do not implement AVL or red-black trees."
      ],
      "resources": [
        {
          "label": "Intro to Trees",
          "url": "https://www.coursera.org/lecture/data-structures/trees-95qda"
        },
        {
          "label": "Tree Traversal",
          "url": "https://www.coursera.org/lecture/data-structures/tree-traversal-fr51b"
        },
        {
          "label": "Binary Search Tree Review",
          "url": "https://www.youtube.com/watch?v=x6At0nzX92o&index=1&list=PLA5Lqm4uh9Bbq-E0ZnqTIa8LRaL77ica6"
        },
        {
          "label": "MIT Binary Heaps",
          "url": "https://www.youtube.com/watch?v=Xnpo1atN-Iw&list=PLUl4u3cNGP63EdVPNLG3ToM6LaEUuStEY&index=12"
        },
        {
          "label": "Heap Review Playlist",
          "url": "https://www.youtube.com/playlist?list=PL9xmBV_5YoZNsyqgPW-DNwUeT8F8uhWc6"
        }
      ],
      "checks": [
        "You can code common tree traversals without looking them up.",
        "You can explain BST deletion cases and heap sift-up versus sift-down clearly."
      ],
      "sourceUrl": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#trees"
    },
    {
      "id": "sorting",
      "title": "Sorting as implementation and trade-off practice",
      "phase": "Core Track",
      "estimate": "4-5 sessions",
      "sessions": 5,
      "summary": "CIU uses sorting to force trade-off thinking: stability, in-place behavior, average versus worst-case runtime, and which data structures each algorithm suits.",
      "items": [
        "Know the best, average, and worst-case behavior of the major comparison sorts.",
        "Implement mergesort and quicksort from scratch.",
        "Understand stability and which sorts fit arrays versus linked lists.",
        "Tie heapsort back to heap operations instead of memorizing it separately."
      ],
      "resources": [
        {
          "label": "Sedgewick Mergesort",
          "url": "https://www.coursera.org/learn/algorithms-part1/home/week/3"
        },
        {
          "label": "Sedgewick Quicksort",
          "url": "https://www.coursera.org/learn/algorithms-part1/home/week/3"
        },
        {
          "label": "Sorting in 18 Minutes",
          "url": "https://www.youtube.com/playlist?list=PL9xmBV_5YoZOZSbGAXAPIq1BeUf4j20pl"
        },
        {
          "label": "Visual Sort Comparison",
          "url": "https://www.youtube.com/watch?v=kPRA0W1kECg"
        },
        {
          "label": "Merge Sort for Linked List",
          "url": "http://www.geeksforgeeks.org/merge-sort-for-linked-list/"
        }
      ],
      "checks": [
        "You can explain why quicksort is often preferred despite its worst-case behavior.",
        "You can explain stability and give an example where it matters."
      ],
      "sourceUrl": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#sorting"
    },
    {
      "id": "graphs",
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
        "Train yourself to ask whether a problem is secretly a graph problem first."
      ],
      "resources": [
        {
          "label": "MIT Breadth-First Search",
          "url": "https://www.youtube.com/watch?v=oFVYVzlvk9c&t=14s&ab_channel=MITOpenCourseWare"
        },
        {
          "label": "MIT Depth-First Search",
          "url": "https://www.youtube.com/watch?v=IBfWDYSffUU&t=32s&ab_channel=MITOpenCourseWare"
        },
        {
          "label": "Skiena Graph Data Structures",
          "url": "https://www.youtube.com/watch?v=Sjk0xqWWPCc&list=PLOtl7M3yp-DX6ic0HGT0PUX_wiNmkWkXx&index=10"
        },
        {
          "label": "Algorithms on Graphs",
          "url": "https://www.coursera.org/learn/algorithms-on-graphs/home/welcome"
        },
        {
          "label": "Shortest Path Review",
          "url": "https://www.youtube.com/playlist?list=PL9xmBV_5YoZO-Y-H3xIC9DGSfVYJng9Yw"
        }
      ],
      "checks": [
        "You can move between graph representations without getting lost.",
        "You can identify when BFS, DFS, Dijkstra, or MST is the relevant mental model."
      ],
      "sourceUrl": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#graphs"
    },
    {
      "id": "recursion-dp",
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
        "Review a light set of design patterns rather than turning this into a deep OO detour."
      ],
      "resources": [
        {
          "label": "Stanford Recursion Lectures",
          "url": "https://www.youtube.com/watch?v=gl3emqCuueQ&list=PLFE6E58F856038C69&index=8"
        },
        {
          "label": "5 Steps for Recursive Problems",
          "url": "https://youtu.be/ngCos392W4w"
        },
        {
          "label": "Skiena Dynamic Programming Intro",
          "url": "https://www.youtube.com/watch?v=wAA0AMfcJHQ&list=PLOtl7M3yp-DX6ic0HGT0PUX_wiNmkWkXx&index=18"
        },
        {
          "label": "DP Problem Playlist",
          "url": "https://www.youtube.com/playlist?list=PLrmLmBdmIlpsHaNTPP_jHHDx_os9ItYXr"
        },
        {
          "label": "Head First Design Patterns",
          "url": "https://www.amazon.com/Head-First-Design-Patterns-Freeman/dp/0596007124"
        }
      ],
      "checks": [
        "You can tell the difference between brute-force recursion, backtracking, and DP.",
        "You can explain a DP state and transition instead of only remembering a final formula."
      ],
      "sourceUrl": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#even-more-knowledge"
    },
    {
      "id": "systems-basics",
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
        "Get a functional understanding of HTTP, TCP versus UDP, TLS, and sockets."
      ],
      "resources": [
        {
          "label": "How CPU Executes a Program",
          "url": "https://www.youtube.com/watch?v=XM4lGflQFvA"
        },
        {
          "label": "MIT Memory Hierarchy",
          "url": "https://www.youtube.com/watch?v=vjYF_fAZI5E&list=PLrRW1w6CGAcXbMtDFj205vALOGmiRc82-&index=24"
        },
        {
          "label": "Operating Systems and System Programming",
          "url": "https://archive.org/details/ucberkeley-webcast-PL-XXv-cvA_iBDyz-ba4yDskqMDY6A1w_c"
        },
        {
          "label": "Agile Software Testing",
          "url": "https://www.youtube.com/watch?v=SAhJf36_u5U"
        },
        {
          "label": "Khan Academy Computers and the Internet",
          "url": "https://www.khanacademy.org/computing/code-org/computers-and-the-internet"
        }
      ],
      "checks": [
        "You can answer follow-up questions about caches, threads, or networking without freezing.",
        "You can connect performance issues back to memory, concurrency, or I/O behavior."
      ],
      "sourceUrl": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#even-more-knowledge"
    },
    {
      "id": "review-interview",
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
        "Prepare thoughtful questions for the interviewer before each loop."
      ],
      "resources": [
        {
          "label": "Final Review Playlist",
          "url": "https://www.youtube.com/watch?v=r4r1DZcx1cM&list=PLmVb1OknmNJuC5POdcDv5oCS7_OUkDgpj&index=22"
        },
        {
          "label": "Tech Interview Handbook Resume Guide",
          "url": "https://www.techinterviewhandbook.org/resume/guide"
        },
        {
          "label": "How to Pass the Engineering Interview",
          "url": "https://davidbyttow.medium.com/how-to-pass-the-engineering-interview-in-2021-45f1b389a1"
        },
        {
          "label": "Pramp Mock Interviews",
          "url": "https://www.pramp.com/"
        },
        {
          "label": "Interviewing.io",
          "url": "https://interviewing.io"
        }
      ],
      "checks": [
        "You can explain your projects and study work with structure, not rambling detail.",
        "You have both technical and behavioral practice in your calendar before applying widely."
      ],
      "sourceUrl": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#final-review"
    },
    {
      "id": "system-design",
      "title": "Optional: system design and scalability",
      "phase": "Optional Advanced",
      "estimate": "Only if needed",
      "sessions": 8,
      "summary": "CIU explicitly says this is for 4+ years of experience. Keep it out of the core plan unless the roles you want actually require system design rounds.",
      "items": [
        "Skip this module entirely for entry-level prep unless your target role clearly expects it.",
        "Start with the System Design Primer and the HiredInTech process explanation.",
        "Practice framing constraints, load, storage, trade-offs, and bottlenecks on paper.",
        "Study a few real-world architectures instead of trying to absorb the entire appendix."
      ],
      "resources": [
        {
          "label": "The System Design Primer",
          "url": "https://github.com/donnemartin/system-design-primer"
        },
        {
          "label": "System Design from HiredInTech",
          "url": "http://www.hiredintech.com/system-design/"
        },
        {
          "label": "8 Steps Guide to System Design",
          "url": "https://javascript.plainenglish.io/8-steps-guide-to-ace-a-system-design-interview-7a5a797f4d7d"
        },
        {
          "label": "CIU System Design Cheat Sheet",
          "url": "https://github.com/jwasham/coding-interview-university/blob/main/extras/cheat%20sheets/system-design.pdf"
        },
        {
          "label": "MIT 6.824 Distributed Systems",
          "url": "https://www.youtube.com/watch?v=cQP8WApzIQQ&list=PLrw6a1wE39_tb2fErI4-WkMbsvGQk9_UB"
        }
      ],
      "checks": [
        "You can scope a design question before jumping into components.",
        "You can talk through trade-offs instead of listing infrastructure buzzwords."
      ],
      "sourceUrl": "https://github.com/jwasham/coding-interview-university/blob/master/README.md#system-design-scalability-data-handling"
    },
    {
      "id": "leetcode-course-arraystrings",
      "title": "LeetCode Crash Course: Arrays and strings",
      "phase": "LeetCode Course",
      "countsTowardSchedule": false,
      "estimate": "3 sessions",
      "sessions": 3,
      "summary": "Arrays and strings are two of the most fundamental data structures seen in algorithm problems. They're very similar when it comes to solving problems as they're both an ordered collection of elements that can be iterated over. Imported from the purchased LeetCode crash course with 14 lessons and exercises.",
      "items": [
        "Study: Arrays and strings",
        "Study: Two pointers",
        "Solve: Reverse String",
        "Solve: Squares of a Sorted Array",
        "Study: Sliding window",
        "Solve: Maximum Average Subarray I",
        "Solve: Max Consecutive Ones III",
        "Study: Prefix sum",
        "Solve: Running Sum of 1d Array",
        "Solve: Minimum Value to Get Positive Step by Step Sum",
        "Solve: K Radius Subarray Averages",
        "Study: More common patterns",
        "Study: Arrays and strings quiz",
        "Study: Bonus problems, arrays and strings"
      ],
      "resources": [
        {
          "label": "Open chapter on LeetCode",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/703/arraystrings/"
        },
        {
          "label": "Lesson: Arrays and strings",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/703/arraystrings/4500/"
        },
        {
          "label": "Lesson: Two pointers",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/703/arraystrings/4501/"
        },
        {
          "label": "Problem: Reverse String",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/703/arraystrings/4592/"
        },
        {
          "label": "Problem: Squares of a Sorted Array",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/703/arraystrings/4689/"
        },
        {
          "label": "Lesson: Sliding window",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/703/arraystrings/4502/"
        },
        {
          "label": "Problem: Maximum Average Subarray I",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/703/arraystrings/4594/"
        },
        {
          "label": "Problem: Max Consecutive Ones III",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/703/arraystrings/4595/"
        },
        {
          "label": "Lesson: Prefix sum",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/703/arraystrings/4503/"
        },
        {
          "label": "Problem: Running Sum of 1d Array",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/703/arraystrings/4658/"
        },
        {
          "label": "Problem: Minimum Value to Get Positive Step by Step Sum",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/703/arraystrings/4657/"
        },
        {
          "label": "Problem: K Radius Subarray Averages",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/703/arraystrings/4836/"
        },
        {
          "label": "Lesson: More common patterns",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/703/arraystrings/4504/"
        },
        {
          "label": "Lesson: Arrays and strings quiz",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/703/arraystrings/4505/"
        },
        {
          "label": "Lesson: Bonus problems, arrays and strings",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/703/arraystrings/4705/"
        }
      ],
      "checks": [
        "You worked through the arrays and strings lessons and attempted the practice problems.",
        "You can explain the chapter's main patterns before looking at the walkthrough again."
      ],
      "sourceUrl": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/703/arraystrings/"
    },
    {
      "id": "leetcode-course-hashing",
      "title": "LeetCode Crash Course: Hashing",
      "phase": "LeetCode Course",
      "countsTowardSchedule": false,
      "estimate": "4 sessions",
      "sessions": 4,
      "summary": "Hashing can be used to implement a hash map - arguably the most powerful data structure or algorithm. Imported from the purchased LeetCode crash course with 16 lessons and exercises.",
      "items": [
        "Study: Hashing",
        "Study: Checking for existence",
        "Solve: Check if the Sentence Is Pangram",
        "Solve: Missing Number",
        "Solve: Counting Elements",
        "Study: Counting",
        "Solve: Find Players With Zero or One Losses",
        "Solve: Largest Unique Number",
        "Solve: Maximum Number of Balloons",
        "Solve: Contiguous Array",
        "Study: More hashing examples",
        "Solve: Ransom Note",
        "Solve: Jewels and Stones",
        "Solve: Longest Substring Without Repeating Characters",
        "Study: Hashing quiz",
        "Study: Bonus problems, hashing"
      ],
      "resources": [
        {
          "label": "Open chapter on LeetCode",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/705/hashing/"
        },
        {
          "label": "Lesson: Hashing",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/705/hashing/4510/"
        },
        {
          "label": "Lesson: Checking for existence",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/705/hashing/4511/"
        },
        {
          "label": "Problem: Check if the Sentence Is Pangram",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/705/hashing/4601/"
        },
        {
          "label": "Problem: Missing Number",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/705/hashing/4602/"
        },
        {
          "label": "Problem: Counting Elements",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/705/hashing/4661/"
        },
        {
          "label": "Lesson: Counting",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/705/hashing/4512/"
        },
        {
          "label": "Problem: Find Players With Zero or One Losses",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/705/hashing/4606/"
        },
        {
          "label": "Problem: Largest Unique Number",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/705/hashing/4662/"
        },
        {
          "label": "Problem: Maximum Number of Balloons",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/705/hashing/4663/"
        },
        {
          "label": "Problem: Contiguous Array",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/705/hashing/4845/"
        },
        {
          "label": "Lesson: More hashing examples",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/705/hashing/4645/"
        },
        {
          "label": "Problem: Ransom Note",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/705/hashing/4607/"
        },
        {
          "label": "Problem: Jewels and Stones",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/705/hashing/4664/"
        },
        {
          "label": "Problem: Longest Substring Without Repeating Characters",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/705/hashing/4690/"
        },
        {
          "label": "Lesson: Hashing quiz",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/705/hashing/4513/"
        },
        {
          "label": "Lesson: Bonus problems, hashing",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/705/hashing/4706/"
        }
      ],
      "checks": [
        "You worked through the hashing lessons and attempted the practice problems.",
        "You can explain the chapter's main patterns before looking at the walkthrough again."
      ],
      "sourceUrl": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/705/hashing/"
    },
    {
      "id": "leetcode-course-linked-lists",
      "title": "LeetCode Crash Course: Linked lists",
      "phase": "LeetCode Course",
      "countsTowardSchedule": false,
      "estimate": "2 sessions",
      "sessions": 2,
      "summary": "Linked lists are like arrays - they're an ordered collection of elements. The main difference is how they are implemented. Linked lists make use of pointers, which is a very important concept for any software engineer. They're also used to implement other important data structures. Imported from the purchased LeetCode crash course with 8 lessons and exercises.",
      "items": [
        "Study: Linked lists",
        "Study: Fast and slow pointers",
        "Solve: Middle of the Linked List",
        "Solve: Remove Duplicates from Sorted List",
        "Study: Reversing a linked list",
        "Solve: Reverse Linked List II",
        "Study: Linked list quiz",
        "Study: Bonus problems, linked lists"
      ],
      "resources": [
        {
          "label": "Open chapter on LeetCode",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/704/linked-lists/"
        },
        {
          "label": "Lesson: Linked lists",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/704/linked-lists/4506/"
        },
        {
          "label": "Lesson: Fast and slow pointers",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/704/linked-lists/4507/"
        },
        {
          "label": "Problem: Middle of the Linked List",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/704/linked-lists/4660/"
        },
        {
          "label": "Problem: Remove Duplicates from Sorted List",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/704/linked-lists/4597/"
        },
        {
          "label": "Lesson: Reversing a linked list",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/704/linked-lists/4600/"
        },
        {
          "label": "Problem: Reverse Linked List II",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/704/linked-lists/4598/"
        },
        {
          "label": "Lesson: Linked list quiz",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/704/linked-lists/4509/"
        },
        {
          "label": "Lesson: Bonus problems, linked lists",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/704/linked-lists/4707/"
        }
      ],
      "checks": [
        "You worked through the linked lists lessons and attempted the practice problems.",
        "You can explain the chapter's main patterns before looking at the walkthrough again."
      ],
      "sourceUrl": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/704/linked-lists/"
    },
    {
      "id": "leetcode-course-stacks-and-queues",
      "title": "LeetCode Crash Course: Stacks and queues",
      "phase": "LeetCode Course",
      "countsTowardSchedule": false,
      "estimate": "3 sessions",
      "sessions": 3,
      "summary": "Stacks and queues are data structures defined by their interfaces. They're a good example of how a simple idea can be used to implement efficient algorithms, and how data structures & algorithms show up in our everyday lives. Imported from the purchased LeetCode crash course with 11 lessons and exercises.",
      "items": [
        "Study: Stacks",
        "Study: String problems",
        "Solve: Simplify Path",
        "Solve: Make The String Great",
        "Study: Queues",
        "Solve: Moving Average from Data Stream",
        "Study: Monotonic",
        "Solve: Next Greater Element I",
        "Solve: Online Stock Span",
        "Study: Stacks and queues quiz",
        "Study: Bonus problems, stacks and queues"
      ],
      "resources": [
        {
          "label": "Open chapter on LeetCode",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/706/stacks-and-queues/"
        },
        {
          "label": "Lesson: Stacks",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/706/stacks-and-queues/4514/"
        },
        {
          "label": "Lesson: String problems",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/706/stacks-and-queues/4646/"
        },
        {
          "label": "Problem: Simplify Path",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/706/stacks-and-queues/4610/"
        },
        {
          "label": "Problem: Make The String Great",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/706/stacks-and-queues/4611/"
        },
        {
          "label": "Lesson: Queues",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/706/stacks-and-queues/4516/"
        },
        {
          "label": "Problem: Moving Average from Data Stream",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/706/stacks-and-queues/4703/"
        },
        {
          "label": "Lesson: Monotonic",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/706/stacks-and-queues/4517/"
        },
        {
          "label": "Problem: Next Greater Element I",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/706/stacks-and-queues/4612/"
        },
        {
          "label": "Problem: Online Stock Span",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/706/stacks-and-queues/4667/"
        },
        {
          "label": "Lesson: Stacks and queues quiz",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/706/stacks-and-queues/4518/"
        },
        {
          "label": "Lesson: Bonus problems, stacks and queues",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/706/stacks-and-queues/4708/"
        }
      ],
      "checks": [
        "You worked through the stacks and queues lessons and attempted the practice problems.",
        "You can explain the chapter's main patterns before looking at the walkthrough again."
      ],
      "sourceUrl": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/706/stacks-and-queues/"
    },
    {
      "id": "leetcode-course-traversals-trees-graphs",
      "title": "LeetCode Crash Course: Trees and graphs",
      "phase": "LeetCode Course",
      "countsTowardSchedule": false,
      "estimate": "6 sessions",
      "sessions": 6,
      "summary": "Trees and graphs are arguably the most important topic when it comes to software engineering interviews. Their implementations are ubiquitous in the real world. Imported from the purchased LeetCode crash course with 28 lessons and exercises.",
      "items": [
        "Study: Binary trees",
        "Study: Binary trees - DFS",
        "Solve: Minimum Depth of Binary Tree",
        "Solve: Maximum Difference Between Node and Ancestor",
        "Solve: Diameter of Binary Tree",
        "Study: Binary trees - BFS",
        "Solve: Deepest Leaves Sum",
        "Solve: Binary Tree Zigzag Level Order Traversal",
        "Study: Binary search trees",
        "Solve: Insert into a Binary Search Tree",
        "Solve: Closest Binary Search Tree Value",
        "Study: Trees quiz",
        "Study: Graphs",
        "Study: Graphs - DFS",
        "Solve: Find if Path Exists in Graph",
        "Solve: Number of Connected Components in an Undirected Graph",
        "Solve: Max Area of Island",
        "Solve: Reachable Nodes With Restrictions",
        "Study: Graphs - BFS",
        "Solve: Nearest Exit from Entrance in Maze",
        "Solve: Snakes and Ladders",
        "Study: Implicit graphs",
        "Solve: Minimum Genetic Mutation",
        "Solve: Jump Game III",
        "Solve: Detonate the Maximum Bombs",
        "Solve: Word Ladder",
        "Study: Graphs quiz",
        "Study: Bonus problems, trees and graphs"
      ],
      "resources": [
        {
          "label": "Open chapter on LeetCode",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/"
        },
        {
          "label": "Lesson: Binary trees",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4722/"
        },
        {
          "label": "Lesson: Binary trees - DFS",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4686/"
        },
        {
          "label": "Problem: Minimum Depth of Binary Tree",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4691/"
        },
        {
          "label": "Problem: Maximum Difference Between Node and Ancestor",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4617/"
        },
        {
          "label": "Problem: Diameter of Binary Tree",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4669/"
        },
        {
          "label": "Lesson: Binary trees - BFS",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4619/"
        },
        {
          "label": "Problem: Deepest Leaves Sum",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4620/"
        },
        {
          "label": "Problem: Binary Tree Zigzag Level Order Traversal",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4621/"
        },
        {
          "label": "Lesson: Binary search trees",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4622/"
        },
        {
          "label": "Problem: Insert into a Binary Search Tree",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4623/"
        },
        {
          "label": "Problem: Closest Binary Search Tree Value",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4692/"
        },
        {
          "label": "Lesson: Trees quiz",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4625/"
        },
        {
          "label": "Lesson: Graphs",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4721/"
        },
        {
          "label": "Lesson: Graphs - DFS",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4626/"
        },
        {
          "label": "Problem: Find if Path Exists in Graph",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4693/"
        },
        {
          "label": "Problem: Number of Connected Components in an Undirected Graph",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4670/"
        },
        {
          "label": "Problem: Max Area of Island",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4628/"
        },
        {
          "label": "Problem: Reachable Nodes With Restrictions",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4629/"
        },
        {
          "label": "Lesson: Graphs - BFS",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4631/"
        },
        {
          "label": "Problem: Nearest Exit from Entrance in Maze",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4632/"
        },
        {
          "label": "Problem: Snakes and Ladders",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4838/"
        },
        {
          "label": "Lesson: Implicit graphs",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4635/"
        },
        {
          "label": "Problem: Minimum Genetic Mutation",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4636/"
        },
        {
          "label": "Problem: Jump Game III",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4672/"
        },
        {
          "label": "Problem: Detonate the Maximum Bombs",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4837/"
        },
        {
          "label": "Problem: Word Ladder",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4637/"
        },
        {
          "label": "Lesson: Graphs quiz",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4644/"
        },
        {
          "label": "Lesson: Bonus problems, trees and graphs",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/4709/"
        }
      ],
      "checks": [
        "You worked through the trees and graphs lessons and attempted the practice problems.",
        "You can explain the chapter's main patterns before looking at the walkthrough again."
      ],
      "sourceUrl": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/707/traversals-trees-graphs/"
    },
    {
      "id": "leetcode-course-heaps",
      "title": "LeetCode Crash Course: Heaps",
      "phase": "LeetCode Course",
      "countsTowardSchedule": false,
      "estimate": "2 sessions",
      "sessions": 2,
      "summary": "A priority queue, commonly referred to as a heap, is a powerful data structure for querying maximum and minimum elements. Imported from the purchased LeetCode crash course with 10 lessons and exercises.",
      "items": [
        "Study: Heaps",
        "Study: Heap examples",
        "Solve: Remove Stones to Minimize the Total",
        "Solve: Minimum Cost to Connect Sticks",
        "Study: Top k",
        "Solve: Kth Largest Element in an Array",
        "Solve: K Closest Points to Origin",
        "Solve: Kth Largest Element in a Stream",
        "Study: Heap quiz",
        "Study: Bonus problems, heaps"
      ],
      "resources": [
        {
          "label": "Open chapter on LeetCode",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/708/heaps/"
        },
        {
          "label": "Lesson: Heaps",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/708/heaps/4638/"
        },
        {
          "label": "Lesson: Heap examples",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/708/heaps/4649/"
        },
        {
          "label": "Problem: Remove Stones to Minimize the Total",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/708/heaps/4640/"
        },
        {
          "label": "Problem: Minimum Cost to Connect Sticks",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/708/heaps/4674/"
        },
        {
          "label": "Lesson: Top k",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/708/heaps/4641/"
        },
        {
          "label": "Problem: Kth Largest Element in an Array",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/708/heaps/4839/"
        },
        {
          "label": "Problem: K Closest Points to Origin",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/708/heaps/4642/"
        },
        {
          "label": "Problem: Kth Largest Element in a Stream",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/708/heaps/4846/"
        },
        {
          "label": "Lesson: Heap quiz",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/708/heaps/4847/"
        },
        {
          "label": "Lesson: Bonus problems, heaps",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/708/heaps/4848/"
        }
      ],
      "checks": [
        "You worked through the heaps lessons and attempted the practice problems.",
        "You can explain the chapter's main patterns before looking at the walkthrough again."
      ],
      "sourceUrl": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/708/heaps/"
    },
    {
      "id": "leetcode-course-greedy",
      "title": "LeetCode Crash Course: Greedy",
      "phase": "LeetCode Course",
      "countsTowardSchedule": false,
      "estimate": "2 sessions",
      "sessions": 2,
      "summary": "\"Greedy\" is more of a problem solving approach than a data structure or algorithm. You could argue that most of the solutions in the previous chapters were greedy algorithms. Imported from the purchased LeetCode crash course with 8 lessons and exercises.",
      "items": [
        "Study: Greedy algorithms",
        "Study: Example greedy problems",
        "Solve: Maximum 69 Number",
        "Solve: Maximum Units on a Truck",
        "Solve: How Many Apples Can You Put into the Basket",
        "Solve: Reduce Array Size to The Half",
        "Study: Greedy quiz",
        "Study: Bonus problems, greedy"
      ],
      "resources": [
        {
          "label": "Open chapter on LeetCode",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/709/greedy/"
        },
        {
          "label": "Lesson: Greedy algorithms",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/709/greedy/4529/"
        },
        {
          "label": "Lesson: Example greedy problems",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/709/greedy/4647/"
        },
        {
          "label": "Problem: Maximum 69 Number",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/709/greedy/4560/"
        },
        {
          "label": "Problem: Maximum Units on a Truck",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/709/greedy/4676/"
        },
        {
          "label": "Problem: How Many Apples Can You Put into the Basket",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/709/greedy/4677/"
        },
        {
          "label": "Problem: Reduce Array Size to The Half",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/709/greedy/4678/"
        },
        {
          "label": "Lesson: Greedy quiz",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/709/greedy/4530/"
        },
        {
          "label": "Lesson: Bonus problems, greedy",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/709/greedy/4711/"
        }
      ],
      "checks": [
        "You worked through the greedy lessons and attempted the practice problems.",
        "You can explain the chapter's main patterns before looking at the walkthrough again."
      ],
      "sourceUrl": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/709/greedy/"
    },
    {
      "id": "leetcode-course-binary-search",
      "title": "LeetCode Crash Course: Binary search",
      "phase": "LeetCode Course",
      "countsTowardSchedule": false,
      "estimate": "2 sessions",
      "sessions": 2,
      "summary": "Binary search is an extremely powerful algorithm. It's not often that you can use it, but when you can, it greatly speeds up any algorithm. Imported from the purchased LeetCode crash course with 10 lessons and exercises.",
      "items": [
        "Study: Binary Search",
        "Study: On arrays",
        "Solve: Search Insert Position",
        "Solve: Longest Subsequence With Limited Sum",
        "Study: On solution spaces",
        "Solve: Find the Smallest Divisor Given a Threshold",
        "Solve: Divide Chocolate",
        "Solve: Split Array Largest Sum",
        "Study: Binary search quiz",
        "Study: Bonus problems, binary search"
      ],
      "resources": [
        {
          "label": "Open chapter on LeetCode",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/710/binary-search/"
        },
        {
          "label": "Lesson: Binary Search",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/710/binary-search/4696/"
        },
        {
          "label": "Lesson: On arrays",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/710/binary-search/4532/"
        },
        {
          "label": "Problem: Search Insert Position",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/710/binary-search/4569/"
        },
        {
          "label": "Problem: Longest Subsequence With Limited Sum",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/710/binary-search/4574/"
        },
        {
          "label": "Lesson: On solution spaces",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/710/binary-search/4533/"
        },
        {
          "label": "Problem: Find the Smallest Divisor Given a Threshold",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/710/binary-search/4694/"
        },
        {
          "label": "Problem: Divide Chocolate",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/710/binary-search/4681/"
        },
        {
          "label": "Problem: Split Array Largest Sum",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/710/binary-search/4573/"
        },
        {
          "label": "Lesson: Binary search quiz",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/710/binary-search/4534/"
        },
        {
          "label": "Lesson: Bonus problems, binary search",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/710/binary-search/4712/"
        }
      ],
      "checks": [
        "You worked through the binary search lessons and attempted the practice problems.",
        "You can explain the chapter's main patterns before looking at the walkthrough again."
      ],
      "sourceUrl": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/710/binary-search/"
    },
    {
      "id": "leetcode-course-backtracking",
      "title": "LeetCode Crash Course: Backtracking",
      "phase": "LeetCode Course",
      "countsTowardSchedule": false,
      "estimate": "2 sessions",
      "sessions": 2,
      "summary": "Backtracking is a general technique that builds promising candidates and discards candidates that cannot lead to an answer. It's an important concept as some problems can only be (reasonably) solved with backtracking. Imported from the purchased LeetCode crash course with 10 lessons and exercises.",
      "items": [
        "Study: Backtracking",
        "Study: Generation",
        "Solve: All Paths From Source to Target",
        "Solve: Letter Combinations of a Phone Number",
        "Study: More constrained backtracking",
        "Solve: Generate Parentheses",
        "Solve: Numbers With Same Consecutive Differences",
        "Solve: Combination Sum III",
        "Study: Backtracking quiz",
        "Study: Bonus problems, backtracking"
      ],
      "resources": [
        {
          "label": "Open chapter on LeetCode",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/711/backtracking/"
        },
        {
          "label": "Lesson: Backtracking",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/711/backtracking/4535/"
        },
        {
          "label": "Lesson: Generation",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/711/backtracking/4536/"
        },
        {
          "label": "Problem: All Paths From Source to Target",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/711/backtracking/4575/"
        },
        {
          "label": "Problem: Letter Combinations of a Phone Number",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/711/backtracking/4577/"
        },
        {
          "label": "Lesson: More constrained backtracking",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/711/backtracking/4537/"
        },
        {
          "label": "Problem: Generate Parentheses",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/711/backtracking/4578/"
        },
        {
          "label": "Problem: Numbers With Same Consecutive Differences",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/711/backtracking/4695/"
        },
        {
          "label": "Problem: Combination Sum III",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/711/backtracking/4683/"
        },
        {
          "label": "Lesson: Backtracking quiz",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/711/backtracking/4538/"
        },
        {
          "label": "Lesson: Bonus problems, backtracking",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/711/backtracking/4713/"
        }
      ],
      "checks": [
        "You worked through the backtracking lessons and attempted the practice problems.",
        "You can explain the chapter's main patterns before looking at the walkthrough again."
      ],
      "sourceUrl": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/711/backtracking/"
    },
    {
      "id": "leetcode-course-dynamic-programming",
      "title": "LeetCode Crash Course: Dynamic programming",
      "phase": "LeetCode Course",
      "countsTowardSchedule": false,
      "estimate": "3 sessions",
      "sessions": 3,
      "summary": "Everyone's favorite - dynamic programming is a programming method that solves problems by breaking them into smaller problems. While most people dread dynamic programming, the topic can be easily learned. Imported from the purchased LeetCode crash course with 14 lessons and exercises.",
      "items": [
        "Study: Dynamic programming",
        "Study: Framework for DP",
        "Study: 1D problems",
        "Solve: Climbing Stairs",
        "Solve: Min Cost Climbing Stairs",
        "Solve: Coin Change",
        "Study: Multi-dimensional problems",
        "Solve: Best Time to Buy and Sell Stock with Transaction Fee",
        "Solve: Best Time to Buy and Sell Stock with Cooldown",
        "Study: Matrix DP",
        "Solve: Unique Paths II",
        "Solve: Minimum Falling Path Sum",
        "Study: Dynamic programming quiz",
        "Study: Bonus problems, dynamic programming"
      ],
      "resources": [
        {
          "label": "Open chapter on LeetCode",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/712/dynamic-programming/"
        },
        {
          "label": "Lesson: Dynamic programming",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/712/dynamic-programming/4539/"
        },
        {
          "label": "Lesson: Framework for DP",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/712/dynamic-programming/4540/"
        },
        {
          "label": "Lesson: 1D problems",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/712/dynamic-programming/4541/"
        },
        {
          "label": "Problem: Climbing Stairs",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/712/dynamic-programming/4580/"
        },
        {
          "label": "Problem: Min Cost Climbing Stairs",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/712/dynamic-programming/4684/"
        },
        {
          "label": "Problem: Coin Change",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/712/dynamic-programming/4581/"
        },
        {
          "label": "Lesson: Multi-dimensional problems",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/712/dynamic-programming/4542/"
        },
        {
          "label": "Problem: Best Time to Buy and Sell Stock with Transaction Fee",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/712/dynamic-programming/4583/"
        },
        {
          "label": "Problem: Best Time to Buy and Sell Stock with Cooldown",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/712/dynamic-programming/4584/"
        },
        {
          "label": "Lesson: Matrix DP",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/712/dynamic-programming/4543/"
        },
        {
          "label": "Problem: Unique Paths II",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/712/dynamic-programming/4585/"
        },
        {
          "label": "Problem: Minimum Falling Path Sum",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/712/dynamic-programming/4586/"
        },
        {
          "label": "Lesson: Dynamic programming quiz",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/712/dynamic-programming/4544/"
        },
        {
          "label": "Lesson: Bonus problems, dynamic programming",
          "url": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/712/dynamic-programming/4714/"
        }
      ],
      "checks": [
        "You worked through the dynamic programming lessons and attempted the practice problems.",
        "You can explain the chapter's main patterns before looking at the walkthrough again."
      ],
      "sourceUrl": "https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/712/dynamic-programming/"
    }
  ]
};
