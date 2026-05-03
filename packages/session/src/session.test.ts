import { describe, it, expect, beforeEach } from 'vitest';
import { Session } from './session';
import { MemorySessionDriver } from './memory-driver';

describe('Session', () => {
  let driver: MemorySessionDriver;
  let session: Session;

  beforeEach(() => {
    driver = new MemorySessionDriver();
    session = new Session(driver, 'test-id');
  });

  describe('basic get/put', () => {
    it('should store and retrieve a value', async () => {
      await session.start();
      session.put('name', 'Alice');
      expect(session.get('name')).toBe('Alice');
    });

    it('should return default when key is missing', async () => {
      await session.start();
      expect(session.get('missing', 'default')).toBe('default');
    });

    it('should return undefined when key is missing and no default', async () => {
      await session.start();
      expect(session.get('missing')).toBeUndefined();
    });

    it('should persist data across save/load cycle', async () => {
      await session.start();
      session.put('user_id', 42);
      await session.save();

      const session2 = new Session(driver, 'test-id');
      await session2.start();
      expect(session2.get('user_id')).toBe(42);
    });
  });

  describe('has/missing', () => {
    it('should return true when key exists', async () => {
      await session.start();
      session.put('key', 'val');
      expect(session.has('key')).toBe(true);
    });

    it('should return false when key is missing', async () => {
      await session.start();
      expect(session.has('key')).toBe(false);
    });

    it('should return true for missing() when key not set', async () => {
      await session.start();
      expect(session.missing('key')).toBe(true);
    });
  });

  describe('forget/flush', () => {
    it('should remove a key', async () => {
      await session.start();
      session.put('x', 1);
      session.forget('x');
      expect(session.has('x')).toBe(false);
    });

    it('should flush all data', async () => {
      await session.start();
      session.put('a', 1).put('b', 2);
      session.flush();
      expect(session.all()).toEqual({});
    });
  });

  describe('flash', () => {
    it('should be available in the same request cycle', async () => {
      await session.start();
      session.flash('msg', 'success!');
      expect(session.get('msg')).toBe('success!');
    });

    it('should be available in the next request cycle', async () => {
      await session.start();
      session.flash('msg', 'hello');
      await session.save();

      const s2 = new Session(driver, 'test-id');
      await s2.start();
      expect(s2.get('msg')).toBe('hello');
    });

    it('should be removed after two cycles', async () => {
      await session.start();
      session.flash('msg', 'hello');
      await session.save();

      const s2 = new Session(driver, 'test-id');
      await s2.start();
      await s2.save();

      const s3 = new Session(driver, 'test-id');
      await s3.start();
      expect(s3.get('msg')).toBeUndefined();
    });

    it('reflash should keep flash data for another cycle', async () => {
      await session.start();
      session.flash('msg', 'keep me');
      await session.save();

      const s2 = new Session(driver, 'test-id');
      await s2.start();
      s2.reflash();
      await s2.save();

      const s3 = new Session(driver, 'test-id');
      await s3.start();
      expect(s3.get('msg')).toBe('keep me');
    });
  });

  describe('pull', () => {
    it('should return value and remove it', async () => {
      await session.start();
      session.put('tmp', 'value');
      expect(session.pull('tmp')).toBe('value');
      expect(session.has('tmp')).toBe(false);
    });
  });

  describe('increment/decrement', () => {
    it('should increment a counter', async () => {
      await session.start();
      expect(session.increment('hits')).toBe(1);
      expect(session.increment('hits')).toBe(2);
    });

    it('should decrement a counter', async () => {
      await session.start();
      session.put('cnt', 5);
      expect(session.decrement('cnt')).toBe(4);
    });
  });

  describe('regenerate', () => {
    it('should assign a new session ID', async () => {
      await session.start();
      const oldId = session.getId();
      await session.regenerate();
      expect(session.getId()).not.toBe(oldId);
    });

    it('with destroy=true should wipe old session', async () => {
      await session.start();
      session.put('secret', 'data');
      await session.save();

      const oldId = session.getId();
      await session.regenerate(true);
      const old = await driver.read(oldId);
      expect(old).toEqual({});
    });
  });

  describe('invalidate', () => {
    it('should destroy old session and flush data', async () => {
      await session.start();
      session.put('k', 'v');
      await session.save();

      const oldId = session.getId();
      await session.invalidate();

      expect(session.has('k')).toBe(false);
      expect(session.getId()).not.toBe(oldId);
    });
  });

  describe('token()', () => {
    it('should return a consistent CSRF token', async () => {
      await session.start();
      const t1 = session.token();
      const t2 = session.token();
      expect(t1).toBe(t2);
      expect(t1.length).toBeGreaterThan(32);
    });

    it('should persist across save/load', async () => {
      await session.start();
      const token = session.token();
      await session.save();

      const s2 = new Session(driver, 'test-id');
      await s2.start();
      expect(s2.token()).toBe(token);
    });
  });

  describe('previousUrl', () => {
    it('should store and retrieve previous URL', async () => {
      await session.start();
      session.setPreviousUrl('/dashboard');
      expect(session.previousUrl()).toBe('/dashboard');
    });
  });
});
