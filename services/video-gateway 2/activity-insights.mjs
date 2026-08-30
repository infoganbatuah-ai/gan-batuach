export function computeActivityMetrics(pixels, frameWidth = 32, frameHeight = 18) {
  const frameBytes = frameWidth * frameHeight;
  if (!Buffer.isBuffer(pixels) || pixels.length < frameBytes) return null;
  const first = pixels.subarray(0, frameBytes);
  const second = pixels.length >= frameBytes * 2 ? pixels.subarray(frameBytes, frameBytes * 2) : first;
  let luminance = 0;
  let delta = 0;
  for (let index = 0; index < frameBytes; index += 1) {
    luminance += second[index];
    delta += Math.abs(second[index] - first[index]);
  }
  return {
    motion_score: Number((delta / frameBytes / 255).toFixed(4)),
    luminance_score: Number((luminance / frameBytes / 255).toFixed(4)),
    sample_frames: pixels.length >= frameBytes * 2 ? 2 : 1,
    raw_frames_returned: false
  };
}
