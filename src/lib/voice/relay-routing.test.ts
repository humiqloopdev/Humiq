import { describe, expect, it } from 'vitest';
import { buildRelayTargets, isRecoverableRelayErrorMessage, relayDisplayName, resolveRelayUrl } from './relay-routing';

describe('relay routing (single Gemini relay)', () => {
  it('uses the configured relay URL', () => {
    expect(resolveRelayUrl({ relayUrl: 'ws://localhost:8768' })).toBe('ws://localhost:8768');
  });

  it('falls back to the local Gemini relay port when nothing is configured', () => {
    expect(resolveRelayUrl({})).toBe('ws://localhost:8768');
    expect(resolveRelayUrl({ browserProtocol: 'http:', browserHost: 'localhost:5174' })).toBe('ws://localhost:8768');
    expect(resolveRelayUrl({ browserProtocol: 'http:', browserHost: '127.0.0.1:5174' })).toBe('ws://localhost:8768');
  });

  it('uses a same-origin proxy path (wss on https) when hosted remotely', () => {
    expect(resolveRelayUrl({ browserProtocol: 'https:', browserHost: 'app.example.com' })).toBe('wss://app.example.com/ws/voice');
    expect(resolveRelayUrl({ browserProtocol: 'http:', browserHost: 'app.example.com:8080' })).toBe('ws://app.example.com:8080/ws/voice');
  });

  it('an explicit URL wins over the remote-host proxy', () => {
    expect(resolveRelayUrl({ relayUrl: 'wss://relay.example.com', browserProtocol: 'https:', browserHost: 'app.example.com' })).toBe('wss://relay.example.com');
  });

  it('builds exactly one target and names it the Gemini relay', () => {
    const targets = buildRelayTargets({ relayUrl: 'ws://localhost:8768' });
    expect(targets).toEqual([{ kind: 'gemini', url: 'ws://localhost:8768' }]);
    expect(relayDisplayName('gemini')).toBe('Gemini voice relay');
  });

  it('classifies recoverable relay errors', () => {
    expect(isRecoverableRelayErrorMessage('Gemini voice relay websocket error')).toBe(true);
    expect(isRecoverableRelayErrorMessage('Gemini voice relay disconnected')).toBe(true);
    expect(isRecoverableRelayErrorMessage('Invalid interview')).toBe(false);
    expect(isRecoverableRelayErrorMessage(undefined)).toBe(false);
  });
});
