export const calculateSlope = (x1: number, y1: number, x2: number, y2: number): number => {
  if (x2 === x1) return 0;
  return (y2 - y1) / (x2 - x1);
};

export const calculatePercentageError = (experimental: number, theoretical: number): number => {
  if (theoretical === 0) return 0;
  return Math.abs((experimental - theoretical) / theoretical) * 100;
};
