/**
 * @fileoverview Tests for TrainingSession entity
 */
import { TrainingSession } from './training-session';
import { AutomationPattern } from './automation-pattern';
describe('TrainingSession', () => {
    let session;
    beforeEach(() => {
        session = new TrainingSession('test-url');
    });
    describe('initialization', () => {
        it('should create session with correct initial state', () => {
            expect(session.id).toBeDefined();
            expect(session.url).toBe('test-url');
            expect(session.startTime).toBeInstanceOf(Date);
            expect(session.endTime).toBeUndefined();
            expect(session.patterns).toEqual([]);
            expect(session.isActive).toBe(true);
        });
        it('should generate unique IDs', () => {
            const session2 = new TrainingSession('test-url');
            expect(session.id).not.toBe(session2.id);
        });
    });
    describe('pattern management', () => {
        it('should add pattern to session', () => {
            const pattern = new AutomationPattern('Test Pattern', 'click', '.button', 'test-url');
            session.addPattern(pattern);
            expect(session.patterns).toHaveLength(1);
            expect(session.patterns[0]).toBe(pattern);
        });
        it('should throw error when adding pattern to ended session', () => {
            session.end();
            const pattern = new AutomationPattern('Test Pattern', 'click', '.button', 'test-url');
            expect(() => session.addPattern(pattern)).toThrow('Cannot add pattern to ended session');
        });
        it('should validate pattern URL matches session URL', () => {
            const pattern = new AutomationPattern('Test Pattern', 'click', '.button', 'different-url');
            expect(() => session.addPattern(pattern)).toThrow('Pattern URL does not match session URL');
        });
    });
    describe('session lifecycle', () => {
        it('should end session correctly', () => {
            expect(session.isActive).toBe(true);
            expect(session.endTime).toBeUndefined();
            session.end();
            expect(session.isActive).toBe(false);
            expect(session.endTime).toBeInstanceOf(Date);
        });
        it('should calculate duration correctly', () => {
            const startTime = new Date('2024-01-01T10:00:00');
            const endTime = new Date('2024-01-01T10:30:00');
            session.startTime = startTime;
            session.endTime = endTime;
            const duration = session.getDuration();
            expect(duration).toBe(30 * 60 * 1000); // 30 minutes in milliseconds
        });
        it('should return null duration for active session', () => {
            expect(session.getDuration()).toBeNull();
        });
    });
    describe('session validation', () => {
        it('should validate as valid with patterns', () => {
            const pattern = new AutomationPattern('Test Pattern', 'click', '.button', 'test-url');
            session.addPattern(pattern);
            session.end();
            expect(session.isValid()).toBe(true);
        });
        it('should validate as invalid without patterns', () => {
            session.end();
            expect(session.isValid()).toBe(false);
        });
        it('should validate as invalid if still active', () => {
            const pattern = new AutomationPattern('Test Pattern', 'click', '.button', 'test-url');
            session.addPattern(pattern);
            expect(session.isValid()).toBe(false);
        });
    });
    describe('serialization', () => {
        it('should serialize to JSON correctly', () => {
            const pattern = new AutomationPattern('Test Pattern', 'click', '.button', 'test-url');
            session.addPattern(pattern);
            session.end();
            const json = session.toJSON();
            expect(json).toHaveProperty('id', session.id);
            expect(json).toHaveProperty('url', 'test-url');
            expect(json).toHaveProperty('startTime');
            expect(json).toHaveProperty('endTime');
            expect(json).toHaveProperty('patterns');
            expect(json.patterns).toHaveLength(1);
        });
        it('should create from JSON correctly', () => {
            const pattern = new AutomationPattern('Test Pattern', 'click', '.button', 'test-url');
            session.addPattern(pattern);
            session.end();
            const json = session.toJSON();
            const restored = TrainingSession.fromJSON(json);
            expect(restored.id).toBe(session.id);
            expect(restored.url).toBe(session.url);
            expect(restored.patterns).toHaveLength(1);
            expect(restored.isActive).toBe(false);
        });
    });
});
