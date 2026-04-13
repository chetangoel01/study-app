import { describe, expect, it } from 'vitest';
import { buildHarness } from './piston.js';

describe('buildHarness', () => {
  it('includes user code verbatim', () => {
    const harness = buildHarness('def two_sum(nums, t):\n    return []', [{ args: [[1, 2], 3], expected: [0, 1] }], 'two_sum');
    expect(harness).toContain('def two_sum(nums, t):');
  });

  it('injects test cases as JSON literal', () => {
    const cases = [{ args: [[1, 2], 3], expected: [0, 1] }];
    const harness = buildHarness('', cases, 'two_sum');
    expect(harness).toContain(JSON.stringify(cases));
  });

  it('calls the function with spread args', () => {
    const harness = buildHarness('', [{ args: [42], expected: true }], 'is_power_of_two');
    expect(harness).toContain('is_power_of_two');
    expect(harness).toContain('*_case["args"]');
  });

  it('prints JSON to stdout', () => {
    const harness = buildHarness('', [], 'fn');
    expect(harness).toContain('print(_json.dumps(_results))');
  });
});
