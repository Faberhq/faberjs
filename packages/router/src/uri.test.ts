import { Application } from '@faber-js/core';
import { Response } from '@faber-js/http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Router } from './router';
import { Uri } from './uri';

describe('Uri.of / Uri.to', () => {
  it('Uri.of preserves an absolute URL', () => {
    expect(Uri.of('https://example.com/path').toString()).toBe('https://example.com/path');
  });

  it('Uri.to keeps a relative path', () => {
    expect(Uri.to('/dashboard').toString()).toBe('/dashboard');
  });

  it('exposes scheme/host/port/path/fragment accessors for absolute URLs', () => {
    const u = Uri.of('https://example.com:8000/users?page=2#section');
    expect(u.scheme()).toBe('https');
    expect(u.host()).toBe('example.com');
    expect(u.port()).toBe(8000);
    expect(u.path()).toBe('/users');
    expect(u.query()).toEqual({ page: '2' });
    expect(u.fragment()).toBe('section');
  });

  it('returns blanks for relative URIs', () => {
    const u = Uri.to('/x?y=1');
    expect(u.scheme()).toBe('');
    expect(u.host()).toBe('');
    expect(u.port()).toBeNull();
    expect(u.path()).toBe('/x');
  });
});

describe('Uri immutable mutators', () => {
  it('withScheme/withHost/withPort upgrade a relative URI to absolute', () => {
    const u = Uri.of('https://example.com')
      .withScheme('http')
      .withHost('test.com')
      .withPort(8000)
      .withPath('/users')
      .withQuery({ page: 2 })
      .withFragment('section-1');
    expect(u.toString()).toBe('http://test.com:8000/users?page=2#section-1');
  });

  it('withQuery merges and removes nulls', () => {
    const u = Uri.to('/posts?a=1&b=2').withQuery({ a: 9, b: null });
    expect(u.toString()).toBe('/posts?a=9');
  });

  it('withQueryIfMissing only sets unset keys', () => {
    const u = Uri.to('/posts?a=1').withQueryIfMissing({ a: 9, b: 2 });
    expect(u.toString()).toBe('/posts?a=1&b=2');
  });

  it('withoutQuery removes keys', () => {
    expect(Uri.to('/posts?a=1&b=2').withoutQuery('a').toString()).toBe('/posts?b=2');
  });

  it('serialises via toJSON for JSON.stringify', () => {
    expect(JSON.stringify({ url: Uri.to('/x') })).toBe('{"url":"/x"}');
  });
});

describe('Uri.route', () => {
  let app: Application;

  beforeEach(() => {
    app = new Application();
    const router = new Router();
    app.instance('router', router);
    router.get('/posts/:id', (_req) => Promise.resolve(Response.json({}))).name('posts.show');
  });

  afterEach(() => {
    Application.clearInstance();
  });

  it('builds a Uri from a named route', () => {
    expect(Uri.route('posts.show', { id: 7 }).toString()).toBe('/posts/7');
  });

  it('chains fluent mutators on top of a named route', () => {
    void app;
    const u = Uri.route('posts.show', { id: 7 })
      .withScheme('https')
      .withHost('example.com')
      .withQuery({ ref: 'email' });
    expect(u.toString()).toBe('https://example.com/posts/7?ref=email');
  });
});
