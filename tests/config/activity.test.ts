import { describe, expect, test } from 'vitest';
import { firstStageVoteLimit, trackDefinitions } from '../../src/config/activity';

describe('confirmed contest configuration', () => {
  test('keeps the two announced activities as the only two contest tracks', () => {
    expect(trackDefinitions.map((track) => track.id)).toEqual([
      'resonance-theatre',
      'brocade-wardrobe'
    ]);
  });

  test('gives each viewer three first-stage choices in each track', () => {
    expect(firstStageVoteLimit).toBe(3);
  });
});
