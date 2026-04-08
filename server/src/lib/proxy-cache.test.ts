import { describe, it, expect } from 'vitest';
import { isAllowedUrl } from './proxy-cache.js';

describe('isAllowedUrl', () => {
  it('allows wikipedia', () => expect(isAllowedUrl('https://en.wikipedia.org/wiki/Algorithm')).toBe(true));
  it('blocks leetcode explicitly', () => expect(isAllowedUrl('https://leetcode.com/problems/two-sum/')).toBe(false));
  it('blocks localhost', () => expect(isAllowedUrl('http://localhost:8080/secret')).toBe(false));
  it('blocks 192.168.x.x', () => expect(isAllowedUrl('http://192.168.1.1/admin')).toBe(false));
  it('blocks 10.x.x.x', () => expect(isAllowedUrl('http://10.0.0.1/meta')).toBe(false));
  it('blocks AWS metadata endpoint', () => expect(isAllowedUrl('http://169.254.169.254/latest/meta-data/')).toBe(false));
  it('blocks unknown domain', () => expect(isAllowedUrl('https://evil.example.com/page')).toBe(false));
});
