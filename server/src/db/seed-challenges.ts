import { createDb } from './client.js';

const db = createDb();

const challenges = [
  {
    title: 'Two Sum',
    difficulty: 'Easy',
    functionName: 'two_sum',
    leetcodeUrl: 'https://leetcode.com/problems/two-sum/',
    descriptionMarkdown: `## Two Sum

Given an array of integers \`nums\` and an integer \`target\`, return the indices of the two numbers that add up to \`target\`.

You may assume each input has exactly one solution. Return the indices in ascending order.
`,
    starterCode: `def two_sum(nums, target):
    pass`,
    testCases: [
      { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { args: [[3, 2, 4], 6], expected: [1, 2] },
      { args: [[3, 3], 6], expected: [0, 1] },
    ],
    tags: ['arrays', 'hash-map'],
    durationMins: 25,
    activeDate: '2026-04-10',
  },
  {
    title: 'Valid Parentheses',
    difficulty: 'Easy',
    functionName: 'is_valid',
    leetcodeUrl: 'https://leetcode.com/problems/valid-parentheses/',
    descriptionMarkdown: `## Valid Parentheses

Given a string \`s\` containing \`()[]{}\`, determine if it is valid.
`,
    starterCode: `def is_valid(s):
    pass`,
    testCases: [
      { args: ['()'], expected: true },
      { args: ['()[]{}'], expected: true },
      { args: ['(]'], expected: false },
      { args: ['([)]'], expected: false },
    ],
    tags: ['stack', 'strings'],
    durationMins: 20,
    activeDate: '2026-04-11',
  },
  {
    title: 'Best Time to Buy and Sell Stock',
    difficulty: 'Easy',
    functionName: 'max_profit',
    leetcodeUrl: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/',
    descriptionMarkdown: `## Best Time to Buy and Sell Stock

Given an array \`prices\` where \`prices[i]\` is the price on day \`i\`, return the maximum profit from buying and selling once. Return \`0\` if no profit is possible.
`,
    starterCode: `def max_profit(prices):
    pass`,
    testCases: [
      { args: [[7, 1, 5, 3, 6, 4]], expected: 5 },
      { args: [[7, 6, 4, 3, 1]], expected: 0 },
      { args: [[1, 2]], expected: 1 },
    ],
    tags: ['arrays', 'greedy'],
    durationMins: 20,
    activeDate: '2026-04-12',
  },
  {
    title: 'Contains Duplicate',
    difficulty: 'Easy',
    functionName: 'contains_duplicate',
    leetcodeUrl: 'https://leetcode.com/problems/contains-duplicate/',
    descriptionMarkdown: `## Contains Duplicate

Given an integer array \`nums\`, return \`True\` if any value appears at least twice, and \`False\` if every element is distinct.
`,
    starterCode: `def contains_duplicate(nums):
    pass`,
    testCases: [
      { args: [[1, 2, 3, 1]], expected: true },
      { args: [[1, 2, 3, 4]], expected: false },
      { args: [[1, 1, 1, 3, 3, 4, 3, 2, 4, 2]], expected: true },
    ],
    tags: ['arrays', 'hash-set'],
    durationMins: 15,
    activeDate: '2026-04-13',
  },
  {
    title: 'Maximum Subarray',
    difficulty: 'Easy',
    functionName: 'max_subarray',
    leetcodeUrl: 'https://leetcode.com/problems/maximum-subarray/',
    descriptionMarkdown: `## Maximum Subarray

Given an integer array \`nums\`, find the subarray with the largest sum and return its sum.
`,
    starterCode: `def max_subarray(nums):
    pass`,
    testCases: [
      { args: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], expected: 6 },
      { args: [[1]], expected: 1 },
      { args: [[5, 4, -1, 7, 8]], expected: 23 },
    ],
    tags: ['arrays', 'dynamic-programming'],
    durationMins: 25,
    activeDate: '2026-04-14',
  },
  {
    title: 'Climbing Stairs',
    difficulty: 'Easy',
    functionName: 'climb_stairs',
    leetcodeUrl: 'https://leetcode.com/problems/climbing-stairs/',
    descriptionMarkdown: `## Climbing Stairs

You are climbing a staircase with \`n\` steps. Each time you can climb 1 or 2 steps. How many distinct ways can you climb to the top?
`,
    starterCode: `def climb_stairs(n):
    pass`,
    testCases: [
      { args: [2], expected: 2 },
      { args: [3], expected: 3 },
      { args: [5], expected: 8 },
    ],
    tags: ['dynamic-programming', 'math'],
    durationMins: 20,
    activeDate: '2026-04-15',
  },
  {
    title: 'Single Number',
    difficulty: 'Easy',
    functionName: 'single_number',
    leetcodeUrl: 'https://leetcode.com/problems/single-number/',
    descriptionMarkdown: `## Single Number

Given a non-empty array of integers where every element appears twice except for one, find that single one.
`,
    starterCode: `def single_number(nums):
    pass`,
    testCases: [
      { args: [[2, 2, 1]], expected: 1 },
      { args: [[4, 1, 2, 1, 2]], expected: 4 },
      { args: [[1]], expected: 1 },
    ],
    tags: ['arrays', 'bit-manipulation'],
    durationMins: 20,
    activeDate: '2026-04-16',
  },
  {
    title: 'Missing Number',
    difficulty: 'Easy',
    functionName: 'missing_number',
    leetcodeUrl: 'https://leetcode.com/problems/missing-number/',
    descriptionMarkdown: `## Missing Number

Given an array \`nums\` containing \`n\` distinct numbers in the range \`[0, n]\`, return the only number in the range that is missing.
`,
    starterCode: `def missing_number(nums):
    pass`,
    testCases: [
      { args: [[3, 0, 1]], expected: 2 },
      { args: [[0, 1]], expected: 2 },
      { args: [[9, 6, 4, 2, 3, 5, 7, 0, 1]], expected: 8 },
    ],
    tags: ['arrays', 'math'],
    durationMins: 20,
    activeDate: '2026-04-17',
  },
  {
    title: 'Palindrome Number',
    difficulty: 'Easy',
    functionName: 'is_palindrome_number',
    leetcodeUrl: 'https://leetcode.com/problems/palindrome-number/',
    descriptionMarkdown: `## Palindrome Number

Given an integer \`x\`, return \`True\` if \`x\` is a palindrome, and \`False\` otherwise.
`,
    starterCode: `def is_palindrome_number(x):
    pass`,
    testCases: [
      { args: [121], expected: true },
      { args: [-121], expected: false },
      { args: [10], expected: false },
      { args: [0], expected: true },
    ],
    tags: ['math'],
    durationMins: 15,
    activeDate: '2026-04-18',
  },
  {
    title: 'Power of Two',
    difficulty: 'Easy',
    functionName: 'is_power_of_two',
    leetcodeUrl: 'https://leetcode.com/problems/power-of-two/',
    descriptionMarkdown: `## Power of Two

Given an integer \`n\`, return \`True\` if it is a power of two, otherwise return \`False\`.
`,
    starterCode: `def is_power_of_two(n):
    pass`,
    testCases: [
      { args: [1], expected: true },
      { args: [16], expected: true },
      { args: [3], expected: false },
      { args: [0], expected: false },
    ],
    tags: ['math', 'bit-manipulation'],
    durationMins: 15,
    activeDate: '2026-04-19',
  },
  {
    title: 'Roman to Integer',
    difficulty: 'Easy',
    functionName: 'roman_to_int',
    leetcodeUrl: 'https://leetcode.com/problems/roman-to-integer/',
    descriptionMarkdown: `## Roman to Integer

Given a Roman numeral string \`s\`, convert it to an integer.
`,
    starterCode: `def roman_to_int(s):
    pass`,
    testCases: [
      { args: ['III'], expected: 3 },
      { args: ['LVIII'], expected: 58 },
      { args: ['MCMXCIV'], expected: 1994 },
    ],
    tags: ['strings', 'math'],
    durationMins: 20,
    activeDate: '2026-04-20',
  },
  {
    title: 'First Unique Character in a String',
    difficulty: 'Easy',
    functionName: 'first_uniq_char',
    leetcodeUrl: 'https://leetcode.com/problems/first-unique-character-in-a-string/',
    descriptionMarkdown: `## First Unique Character in a String

Given a string \`s\`, find the first non-repeating character and return its index. If it does not exist, return \`-1\`.
`,
    starterCode: `def first_uniq_char(s):
    pass`,
    testCases: [
      { args: ['leetcode'], expected: 0 },
      { args: ['loveleetcode'], expected: 2 },
      { args: ['aabb'], expected: -1 },
    ],
    tags: ['strings', 'hash-map'],
    durationMins: 20,
    activeDate: '2026-04-21',
  },
  {
    title: 'Counting Bits',
    difficulty: 'Easy',
    functionName: 'count_bits',
    leetcodeUrl: 'https://leetcode.com/problems/counting-bits/',
    descriptionMarkdown: `## Counting Bits

Given an integer \`n\`, return an array \`ans\` of length \`n + 1\` such that \`ans[i]\` is the number of 1s in the binary representation of \`i\`.
`,
    starterCode: `def count_bits(n):
    pass`,
    testCases: [
      { args: [2], expected: [0, 1, 1] },
      { args: [5], expected: [0, 1, 1, 2, 1, 2] },
    ],
    tags: ['dynamic-programming', 'bit-manipulation'],
    durationMins: 20,
    activeDate: '2026-04-22',
  },
  {
    title: 'Valid Palindrome',
    difficulty: 'Easy',
    functionName: 'is_palindrome',
    leetcodeUrl: 'https://leetcode.com/problems/valid-palindrome/',
    descriptionMarkdown: `## Valid Palindrome

Given a string \`s\`, return \`True\` if, after lowercasing and stripping non-alphanumeric characters, it reads the same forward and backward.
`,
    starterCode: `def is_palindrome(s):
    pass`,
    testCases: [
      { args: ['A man, a plan, a canal: Panama'], expected: true },
      { args: ['race a car'], expected: false },
      { args: [' '], expected: true },
    ],
    tags: ['strings', 'two-pointers'],
    durationMins: 20,
    activeDate: '2026-04-23',
  },
  {
    title: 'Fizz Buzz',
    difficulty: 'Easy',
    functionName: 'fizz_buzz',
    leetcodeUrl: 'https://leetcode.com/problems/fizz-buzz/',
    descriptionMarkdown: `## Fizz Buzz

Given an integer \`n\`, return the classic Fizz Buzz output for the range 1..n.
`,
    starterCode: `def fizz_buzz(n):
    pass`,
    testCases: [
      { args: [3], expected: ['1', '2', 'Fizz'] },
      { args: [5], expected: ['1', '2', 'Fizz', '4', 'Buzz'] },
      { args: [15], expected: ['1','2','Fizz','4','Buzz','Fizz','7','8','Fizz','Buzz','11','Fizz','13','14','FizzBuzz'] },
    ],
    tags: ['math', 'strings'],
    durationMins: 15,
    activeDate: '2026-04-24',
  },
  {
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'Medium',
    functionName: 'length_of_longest_substring',
    leetcodeUrl: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/',
    descriptionMarkdown: `## Longest Substring Without Repeating Characters

Given a string \`s\`, find the length of the longest substring without repeating characters.
`,
    starterCode: `def length_of_longest_substring(s):
    pass`,
    testCases: [
      { args: ['abcabcbb'], expected: 3 },
      { args: ['bbbbb'], expected: 1 },
      { args: ['pwwkew'], expected: 3 },
      { args: [''], expected: 0 },
    ],
    tags: ['strings', 'sliding-window', 'hash-map'],
    durationMins: 30,
    activeDate: '2026-04-25',
  },
  {
    title: 'Container With Most Water',
    difficulty: 'Medium',
    functionName: 'max_area',
    leetcodeUrl: 'https://leetcode.com/problems/container-with-most-water/',
    descriptionMarkdown: `## Container With Most Water

Given an array \`height\` of non-negative integers, find the two lines that form a container holding the most water.
`,
    starterCode: `def max_area(height):
    pass`,
    testCases: [
      { args: [[1, 8, 6, 2, 5, 4, 8, 3, 7]], expected: 49 },
      { args: [[1, 1]], expected: 1 },
    ],
    tags: ['arrays', 'two-pointers', 'greedy'],
    durationMins: 30,
    activeDate: '2026-04-26',
  },
  {
    title: 'Product of Array Except Self',
    difficulty: 'Medium',
    functionName: 'product_except_self',
    leetcodeUrl: 'https://leetcode.com/problems/product-of-array-except-self/',
    descriptionMarkdown: `## Product of Array Except Self

Given an integer array \`nums\`, return an array where each element is the product of all numbers except itself.
`,
    starterCode: `def product_except_self(nums):
    pass`,
    testCases: [
      { args: [[1, 2, 3, 4]], expected: [24, 12, 8, 6] },
      { args: [[-1, 1, 0, -3, 3]], expected: [0, 0, 9, 0, 0] },
    ],
    tags: ['arrays', 'prefix-sum'],
    durationMins: 30,
    activeDate: '2026-04-27',
  },
  {
    title: 'Find Minimum in Rotated Sorted Array',
    difficulty: 'Medium',
    functionName: 'find_min',
    leetcodeUrl: 'https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/',
    descriptionMarkdown: `## Find Minimum in Rotated Sorted Array

Given a sorted array rotated at some pivot, find the minimum element. The array has no duplicates.
`,
    starterCode: `def find_min(nums):
    pass`,
    testCases: [
      { args: [[3, 4, 5, 1, 2]], expected: 1 },
      { args: [[4, 5, 6, 7, 0, 1, 2]], expected: 0 },
      { args: [[11, 13, 15, 17]], expected: 11 },
    ],
    tags: ['arrays', 'binary-search'],
    durationMins: 30,
    activeDate: '2026-04-28',
  },
  {
    title: 'Jump Game',
    difficulty: 'Medium',
    functionName: 'can_jump',
    leetcodeUrl: 'https://leetcode.com/problems/jump-game/',
    descriptionMarkdown: `## Jump Game

Given an integer array \`nums\` where \`nums[i]\` is the max jump length from position \`i\`, return \`True\` if you can reach the last index from index 0.
`,
    starterCode: `def can_jump(nums):
    pass`,
    testCases: [
      { args: [[2, 3, 1, 1, 4]], expected: true },
      { args: [[3, 2, 1, 0, 4]], expected: false },
      { args: [[0]], expected: true },
    ],
    tags: ['arrays', 'greedy'],
    durationMins: 30,
    activeDate: '2026-04-29',
  },
  {
    title: 'Coin Change',
    difficulty: 'Medium',
    functionName: 'coin_change',
    leetcodeUrl: 'https://leetcode.com/problems/coin-change/',
    descriptionMarkdown: `## Coin Change

Given an array of coin denominations \`coins\` and an integer \`amount\`, return the fewest number of coins needed to make up \`amount\`.
`,
    starterCode: `def coin_change(coins, amount):
    pass`,
    testCases: [
      { args: [[1, 2, 5], 11], expected: 3 },
      { args: [[2], 3], expected: -1 },
      { args: [[1], 0], expected: 0 },
      { args: [[1, 5, 11], 11], expected: 1 },
    ],
    tags: ['dynamic-programming'],
    durationMins: 35,
    activeDate: '2026-04-30',
  },
  {
    title: 'Unique Paths',
    difficulty: 'Medium',
    functionName: 'unique_paths',
    leetcodeUrl: 'https://leetcode.com/problems/unique-paths/',
    descriptionMarkdown: `## Unique Paths

A robot starts at the top-left corner of an \`m x n\` grid and can only move right or down. Return the number of unique paths to the bottom-right corner.
`,
    starterCode: `def unique_paths(m, n):
    pass`,
    testCases: [
      { args: [3, 7], expected: 28 },
      { args: [3, 2], expected: 3 },
      { args: [1, 1], expected: 1 },
    ],
    tags: ['dynamic-programming', 'math'],
    durationMins: 25,
    activeDate: '2026-05-01',
  },
  {
    title: 'House Robber',
    difficulty: 'Medium',
    functionName: 'rob',
    leetcodeUrl: 'https://leetcode.com/problems/house-robber/',
    descriptionMarkdown: `## House Robber

Given an array \`nums\` of non-negative integers representing the amount of money in each house, return the maximum amount you can rob without robbing two adjacent houses.
`,
    starterCode: `def rob(nums):
    pass`,
    testCases: [
      { args: [[1, 2, 3, 1]], expected: 4 },
      { args: [[2, 7, 9, 3, 1]], expected: 12 },
      { args: [[0]], expected: 0 },
    ],
    tags: ['dynamic-programming'],
    durationMins: 30,
    activeDate: '2026-05-02',
  },
  {
    title: 'Decode Ways',
    difficulty: 'Medium',
    functionName: 'num_decodings',
    leetcodeUrl: 'https://leetcode.com/problems/decode-ways/',
    descriptionMarkdown: `## Decode Ways

Given a string of digits, return the number of ways it can be decoded where \`A -> 1\` through \`Z -> 26\`.
`,
    starterCode: `def num_decodings(s):
    pass`,
    testCases: [
      { args: ['12'], expected: 2 },
      { args: ['226'], expected: 3 },
      { args: ['06'], expected: 0 },
    ],
    tags: ['dynamic-programming', 'strings'],
    durationMins: 35,
    activeDate: '2026-05-03',
  },
  {
    title: 'Word Break',
    difficulty: 'Medium',
    functionName: 'word_break',
    leetcodeUrl: 'https://leetcode.com/problems/word-break/',
    descriptionMarkdown: `## Word Break

Given a string \`s\` and a list \`word_dict\`, return \`True\` if \`s\` can be segmented into words from the dictionary.
`,
    starterCode: `def word_break(s, word_dict):
    pass`,
    testCases: [
      { args: ['leetcode', ['leet', 'code']], expected: true },
      { args: ['applepenapple', ['apple', 'pen']], expected: true },
      { args: ['catsandog', ['cats', 'dog', 'sand', 'and', 'cat']], expected: false },
    ],
    tags: ['dynamic-programming', 'strings'],
    durationMins: 35,
    activeDate: '2026-05-04',
  },
  {
    title: 'Maximum Product Subarray',
    difficulty: 'Medium',
    functionName: 'max_product',
    leetcodeUrl: 'https://leetcode.com/problems/maximum-product-subarray/',
    descriptionMarkdown: `## Maximum Product Subarray

Given an integer array \`nums\`, find the contiguous subarray with the largest product and return that product.
`,
    starterCode: `def max_product(nums):
    pass`,
    testCases: [
      { args: [[2, 3, -2, 4]], expected: 6 },
      { args: [[-2, 0, -1]], expected: 0 },
      { args: [[-2, 3, -4]], expected: 24 },
    ],
    tags: ['arrays', 'dynamic-programming'],
    durationMins: 30,
    activeDate: '2026-05-05',
  },
  {
    title: 'Trapping Rain Water',
    difficulty: 'Hard',
    functionName: 'trap',
    leetcodeUrl: 'https://leetcode.com/problems/trapping-rain-water/',
    descriptionMarkdown: `## Trapping Rain Water

Given an elevation map, compute how much water it can trap after raining.
`,
    starterCode: `def trap(height):
    pass`,
    testCases: [
      { args: [[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]], expected: 6 },
      { args: [[4, 2, 0, 3, 2, 5]], expected: 9 },
    ],
    tags: ['arrays', 'two-pointers', 'dynamic-programming'],
    durationMins: 45,
    activeDate: '2026-05-06',
  },
  {
    title: 'Longest Valid Parentheses',
    difficulty: 'Hard',
    functionName: 'longest_valid_parentheses',
    leetcodeUrl: 'https://leetcode.com/problems/longest-valid-parentheses/',
    descriptionMarkdown: `## Longest Valid Parentheses

Given a string \`s\` containing only \`(\` and \`)\`, return the length of the longest valid parentheses substring.
`,
    starterCode: `def longest_valid_parentheses(s):
    pass`,
    testCases: [
      { args: ['(()'], expected: 2 },
      { args: [')()())'], expected: 4 },
      { args: [''], expected: 0 },
    ],
    tags: ['strings', 'stack', 'dynamic-programming'],
    durationMins: 45,
    activeDate: '2026-05-07',
  },
  {
    title: 'Edit Distance',
    difficulty: 'Hard',
    functionName: 'min_distance',
    leetcodeUrl: 'https://leetcode.com/problems/edit-distance/',
    descriptionMarkdown: `## Edit Distance

Given two strings \`word1\` and \`word2\`, return the minimum number of operations required to convert \`word1\` to \`word2\`.
`,
    starterCode: `def min_distance(word1, word2):
    pass`,
    testCases: [
      { args: ['horse', 'ros'], expected: 3 },
      { args: ['intention', 'execution'], expected: 5 },
      { args: ['', ''], expected: 0 },
    ],
    tags: ['dynamic-programming', 'strings'],
    durationMins: 45,
    activeDate: '2026-05-08',
  },
  {
    title: 'Median of Two Sorted Arrays',
    difficulty: 'Hard',
    functionName: 'find_median_sorted_arrays',
    leetcodeUrl: 'https://leetcode.com/problems/median-of-two-sorted-arrays/',
    descriptionMarkdown: `## Median of Two Sorted Arrays

Given two sorted arrays \`nums1\` and \`nums2\`, return the median of the two sorted arrays in logarithmic time.
`,
    starterCode: `def find_median_sorted_arrays(nums1, nums2):
    pass`,
    testCases: [
      { args: [[1, 3], [2]], expected: 2.0 },
      { args: [[1, 2], [3, 4]], expected: 2.5 },
      { args: [[0, 0], [0, 0]], expected: 0.0 },
    ],
    tags: ['arrays', 'binary-search', 'divide-and-conquer'],
    durationMins: 50,
    activeDate: '2026-05-09',
  },
] as const;

const insert = db.prepare(`
  INSERT OR IGNORE INTO daily_challenge_pool
    (title, difficulty, leetcode_url, description_markdown, starter_code,
     function_name, test_cases, tags, duration_mins, active_date)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMany = db.transaction(() => {
  for (const challenge of challenges) {
    insert.run(
      challenge.title,
      challenge.difficulty,
      challenge.leetcodeUrl,
      challenge.descriptionMarkdown,
      challenge.starterCode,
      challenge.functionName,
      JSON.stringify(challenge.testCases),
      JSON.stringify(challenge.tags),
      challenge.durationMins,
      challenge.activeDate,
    );
  }
});

insertMany();

const count = (db.prepare('SELECT COUNT(*) AS n FROM daily_challenge_pool').get() as { n: number }).n;
console.log(
  `Seed complete. daily_challenge_pool now has ${count} row(s) spanning ${challenges[0].activeDate} to ${challenges[challenges.length - 1].activeDate}.`,
);
db.close();
