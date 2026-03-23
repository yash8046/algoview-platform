/**
 * Smart market-aware caching utilities
 */

// IST = UTC+5:30
function getISTHour(): number {
  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  return utcH + 5 + (utcM + 30 >= 60 ? 1 : 0);
}

function getISTDay(): number {
  const now = new Date();
  // Shift to IST
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.getUTCDay(); // 0=Sun, 6=Sat
}

export function isIndianMarketOpen(): boolean {
  const hour = getISTHour();
  const day = getISTDay();
  // Mon-Fri, 9:15 AM to 3:30 PM IST
  if (day === 0 || day === 6) return false;
  if (hour < 9 || hour >= 16) return false;
  if (hour === 9) {
    const min = (new Date().getUTCMinutes() + 30) % 60;
    return min >= 15;
  }
  if (hour === 15) {
    const min = (new Date().getUTCMinutes() + 30) % 60;
    return min <= 30;
  }
  return true;
}

export function getSmartTTL(assetType: 'stock' | 'crypto'): number {
  if (assetType === 'crypto') {
    return 2 * 60 * 1000; // 2 minutes for crypto
  }
  if (isIndianMarketOpen()) {
    return 3 * 60 * 1000; // 3 minutes during market hours
  }
  // Market closed: cache until reasonable time (30 min)
  return 30 * 60 * 1000;
}

export function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Cooldown tracker — prevents spamming API calls
const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 15_000; // 15 second cooldown between calls

export function isOnCooldown(key: string): boolean {
  const last = cooldowns.get(key);
  if (!last) return false;
  return Date.now() - last < COOLDOWN_MS;
}

export function setCooldown(key: string): void {
  cooldowns.set(key, Date.now());
}

export function getCooldownRemaining(key: string): number {
  const last = cooldowns.get(key);
  if (!last) return 0;
  return Math.max(0, COOLDOWN_MS - (Date.now() - last));
}
