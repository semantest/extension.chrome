/**
 * @fileoverview Tests for TrainingSession entity
 */

import { TrainingSession } from './training-session';

describe('TrainingSession', () => {
  let session: TrainingSession;

  beforeEach(() => {
    session = new TrainingSession('test-session-id');
  });

  describe('initialization', () => {
    it('should create session with correct initial state', () => {
      expect(session.id).toBe('test-session-id');
      expect(session.website).toBe('');
      expect(session.mode).toBe('inactive');
      expect(session.isActive).toBe(false);
    });

    it('should have unique IDs', () => {
      const session2 = new TrainingSession('test-session-id-2');
      expect(session.id).not.toBe(session2.id);
    });
  });

  describe('event-driven architecture', () => {
    it('should be an event-driven entity', () => {
      // TrainingSession now uses typescript-eda Entity pattern
      // and handles events through @listen decorators
      expect(session).toBeDefined();
      expect(session.id).toBe('test-session-id');
    });
  });

  describe('session state', () => {
    it('should track session state', () => {
      expect(session.isActive).toBe(false);
      expect(session.mode).toBe('inactive');
      expect(session.website).toBe('');
    });
  });
});