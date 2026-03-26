import { describe, it, expect } from 'vitest';

/**
 * Structural verification tests for Backtest and Strategy page layouts.
 * These validate the fixed-header + scrollable-content pattern required for Android.
 *
 * The layout contract:
 *   <div h-[100dvh] overflow-hidden>       ← viewport lock
 *     <div flex-shrink-0><TopBar /></div>   ← fixed header
 *     <div flex-1 overflow-y-auto|auto>     ← scrollable content
 *   </div>
 */

// We verify the layout by checking the source patterns exist.
// On Android (Capacitor), 100dvh prevents rubber-banding and the
// flex-shrink-0 wrapper ensures TopBar never collapses.

import { readFileSync } from 'fs';
import { resolve } from 'path';

function readSource(file: string) {
  return readFileSync(resolve(__dirname, '../../', file), 'utf-8');
}

describe('BacktestPage layout (Android fixed header)', () => {
  const src = readSource('src/pages/BacktestPage.tsx');

  it('uses 100dvh viewport container', () => {
    expect(src).toContain('h-[100dvh]');
  });

  it('has overflow-hidden on root container', () => {
    expect(src).toContain('overflow-hidden');
  });

  it('wraps TopBar in flex-shrink-0', () => {
    // TopBar must be inside a flex-shrink-0 wrapper
    const topBarIndex = src.indexOf('<TopBar');
    expect(topBarIndex).toBeGreaterThan(-1);
    // Check that flex-shrink-0 appears before TopBar (in the wrapper div)
    const before = src.substring(Math.max(0, topBarIndex - 200), topBarIndex);
    expect(before).toContain('flex-shrink-0');
  });

  it('has scrollable content area', () => {
    expect(src).toContain('overflow-y-auto');
  });

  it('uses flex column layout', () => {
    expect(src).toContain('flex flex-col');
  });
});

describe('StrategyBuilderPage layout (Android fixed header)', () => {
  const src = readSource('src/pages/StrategyBuilderPage.tsx');

  it('uses 100dvh viewport container', () => {
    expect(src).toContain('h-[100dvh]');
  });

  it('has overflow-hidden on root container', () => {
    expect(src).toContain('overflow-hidden');
  });

  it('wraps TopBar in flex-shrink-0', () => {
    const topBarIndex = src.indexOf('<TopBar');
    expect(topBarIndex).toBeGreaterThan(-1);
    const before = src.substring(Math.max(0, topBarIndex - 200), topBarIndex);
    expect(before).toContain('flex-shrink-0');
  });

  it('has scrollable content area with overflow-auto', () => {
    // Strategy page uses overflow-auto or overflow-hidden with nested scroll
    expect(src.includes('overflow-auto') || src.includes('overflow-y-auto')).toBe(true);
  });

  it('uses flex column layout', () => {
    expect(src).toContain('flex flex-col');
  });
});
