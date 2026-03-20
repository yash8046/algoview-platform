export function generateCandlestickData(days: number = 90) {
  const data: { time: string; open: number; high: number; low: number; close: number }[] = [];
  let price = 185;
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const open = price + (Math.random() - 0.48) * 3;
    const volatility = Math.random() * 5 + 1;
    const close = open + (Math.random() - 0.48) * volatility;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;

    data.push({
      time: date.toISOString().split('T')[0],
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
    });
    price = close;
  }
  return data;
}

export function generateVolumeData(candleData: { time: string; open: number; close: number }[]) {
  return candleData.map(c => ({
    time: c.time,
    value: Math.floor(Math.random() * 50000000 + 10000000),
    color: c.close >= c.open ? 'rgba(38, 166, 91, 0.3)' : 'rgba(239, 83, 80, 0.3)',
  }));
}

export function calculateSMA(data: { close: number }[], period: number) {
  const result: { time: string; value: number }[] = [];
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b.close, 0);
    result.push({ time: (data[i] as any).time, value: +(sum / period).toFixed(2) });
  }
  return result;
}

export function calculateRSI(data: { close: number }[], period: number = 14) {
  const result: { time: string; value: number }[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? Math.abs(diff) : 0);

    if (i >= period) {
      const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - 100 / (1 + rs);
      result.push({ time: (data[i] as any).time, value: +rsi.toFixed(2) });
    }
  }
  return result;
}
