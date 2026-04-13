export interface TestCase {
  args: unknown[];
  expected: unknown;
}

export interface TestResult {
  passed: boolean;
  output: string;
  expected: string;
}

interface PistonResponse {
  run?: {
    stdout?: string;
    stderr?: string;
    output?: string;
  };
  compile?: {
    stderr?: string;
  };
}

export function buildHarness(userCode: string, testCases: TestCase[], functionName: string): string {
  const casesJson = JSON.stringify(testCases);

  return `${userCode}

import json as _json
_results = []
_cases = _json.loads("""${casesJson}""")
for _case in _cases:
    try:
        _result = ${functionName}(*_case["args"])
        _results.append({
            "passed": _result == _case["expected"],
            "output": repr(_result),
            "expected": repr(_case["expected"])
        })
    except Exception as _e:
        _results.append({
            "passed": False,
            "output": str(_e),
            "expected": repr(_case["expected"])
        })
print(_json.dumps(_results))
`;
}

export async function runWithPiston(harness: string): Promise<TestResult[]> {
  let response: Response;

  try {
    response = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'python',
        version: '3.10.0',
        files: [{ content: harness }],
      }),
    });
  } catch {
    throw new Error('Execution service unavailable');
  }

  if (!response.ok) {
    throw new Error('Execution service unavailable');
  }

  const data = await response.json() as PistonResponse;
  const stderr = data.compile?.stderr || data.run?.stderr || '';
  const stdout = data.run?.stdout?.trim() ?? '';

  if (!stdout) {
    const errorMsg = stderr || 'No output returned';
    return [{ passed: false, output: errorMsg, expected: '' }];
  }

  try {
    return JSON.parse(stdout) as TestResult[];
  } catch {
    return [{ passed: false, output: stdout, expected: '' }];
  }
}
