// ffmpeg argument builders. The background hue shift uses colorchannelmixer with the exact
// matrix of CSS hue-rotate (from the shared overlay module), in RGB converted with the bt709
// matrix and limited range in and out, so the file matches the preview's CSS filter.
import { hueMatrix } from '../dist/overlay.mjs';

const BT709_TAGS = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
export const SETPARAMS = 'setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv';

/** colorchannelmixer filter for a hue shift in degrees, or null for 0. */
export function mixerFilter(deg) {
  if (!deg) return null;
  const m = hueMatrix(deg).map((v) => v.toFixed(6));
  return `colorchannelmixer=rr=${m[0]}:rg=${m[1]}:rb=${m[2]}:gr=${m[3]}:gg=${m[4]}:gb=${m[5]}:br=${m[6]}:bg=${m[7]}:bb=${m[8]}`;
}

/** Final MP4: shifted background + transparent overlay PNG, H.264 CRF 18, bt709 tagged. */
export function mp4Args({ source, overlay, out, hue, threads = 3 }) {
  const mixer = mixerFilter(hue);
  const graph = [
    `[0:v]scale=in_color_matrix=bt709:in_range=tv,format=gbrp${mixer ? ',' + mixer : ''}[bg]`,
    '[bg][1:v]overlay=0:0:format=rgb[mix]',
    // setparams tags the frames: newer ffmpeg takes color metadata from frames, so the
    // -color_* options alone leave primaries/transfer "unknown"
    '[mix]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,' + SETPARAMS + '[v]',
  ].join(';');
  return [
    '-nostdin', '-v', 'error', '-y',
    '-i', source, '-i', overlay,
    '-filter_complex', graph, '-map', '[v]', '-an',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-threads', String(threads),
    ...BT709_TAGS,
    '-movflags', '+faststart', '-f', 'mp4', out,
  ];
}

/** GIF from the finished MP4 (prototype settings: diff palette, bayer dithering). */
export function gifArgs({ mp4, out, width, fps, threads = 3 }) {
  return [
    '-nostdin', '-v', 'error', '-y', '-i', mp4,
    '-filter_complex',
    `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle`,
    '-threads', String(threads),
    '-loop', '0', '-f', 'gif', out,
  ];
}
