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

/**
 * Final MP4: shifted background, then the overlay layers bottom to top, H.264 CRF 18, bt709 tagged.
 * A layer is a full-frame transparent PNG ({ file }) or an animated GIF placed at its drawn box
 * ({ file, animated: true, x, y, w, h, opacity }), looped for the length of the video. Only the
 * background gets the hue shift. `overlay` alone is the usual case: one PNG with everything.
 */
export function mp4Args({ source, overlay, layers = [{ file: overlay }], out, hue, threads = 3 }) {
  const mixer = mixerFilter(hue);
  const inputs = ['-i', source];
  const graph = [`[0:v]scale=in_color_matrix=bt709:in_range=tv,format=gbrp${mixer ? ',' + mixer : ''}[l0]`];
  layers.forEach((layer, i) => {
    const n = i + 1;
    if (layer.animated) {
      const px = (v) => Math.max(0, Math.round(v));
      const alpha = layer.opacity < 1 ? `,colorchannelmixer=aa=${Math.max(0, layer.opacity).toFixed(4)}` : '';
      // -ignore_loop 0 plays the GIF's own loop (re-encoded GIFs loop forever); the overlay
      // stops with the video (shortest)
      inputs.push('-ignore_loop', '0', '-i', layer.file);
      graph.push(`[${n}:v]scale=${Math.max(1, px(layer.w))}:${Math.max(1, px(layer.h))}:flags=lanczos,format=rgba${alpha}[a${n}]`);
      graph.push(`[l${i}][a${n}]overlay=${px(layer.x)}:${px(layer.y)}:format=rgb:shortest=1[l${n}]`);
    } else {
      inputs.push('-i', layer.file);
      graph.push(`[l${i}][${n}:v]overlay=0:0:format=rgb[l${n}]`);
    }
  });
  // setparams tags the frames: newer ffmpeg takes color metadata from frames, so the
  // -color_* options alone leave primaries/transfer "unknown"
  graph.push(`[l${layers.length}]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,${SETPARAMS}[v]`);
  return [
    '-nostdin', '-v', 'error', '-y',
    ...inputs,
    '-filter_complex', graph.join(';'), '-map', '[v]', '-an',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-threads', String(threads),
    ...BT709_TAGS,
    '-movflags', '+faststart', '-f', 'mp4', out,
  ];
}

// Stills (image templates) stay RGB end to end: no YUV round trip and no bt709 tags. The frames
// are tagged sRGB so the PNG encoder writes an sRGB chunk (not a gAMA/cHRM pair from video tags).
export const SRGB_PARAMS = 'setparams=color_primaries=bt709:color_trc=iec61966-2-1:colorspace=gbr:range=pc';

/** Final PNG of an image template: shifted background + transparent overlay, full resolution. */
export function pngArgs({ source, overlay, out, hue }) {
  const mixer = mixerFilter(hue);
  const graph = [
    `[0:v]format=gbrp${mixer ? ',' + mixer : ''}[bg]`,
    `[bg][1:v]overlay=0:0:format=rgb,format=rgb24,${SRGB_PARAMS}[v]`,
  ].join(';');
  return [
    '-nostdin', '-v', 'error', '-y',
    '-i', source, '-i', overlay,
    '-filter_complex', graph, '-map', '[v]',
    '-frames:v', '1', '-c:v', 'png', '-pred', 'mixed', '-update', '1', '-f', 'image2', out,
  ];
}

/** First frame of a GIF as a PNG (animated logos on image templates). */
export function firstFrameArgs({ gif, out }) {
  return ['-nostdin', '-v', 'error', '-y', '-f', 'gif', '-i', gif, '-frames:v', '1', '-update', '1', '-f', 'image2', out];
}

/** JPEG quality 60..100 -> mjpeg qscale (2 is about 92, 1 the best). */
export function jpegQscale(quality) {
  const q = Math.max(60, Math.min(100, Number(quality) || 92));
  return Math.max(1, Math.round((100 - q) / 4));
}

/**
 * JPG from the finished PNG: full-range BT.601 YCbCr (what JFIF means, so every viewer decodes the
 * same colors), no chroma subsampling so thin colored text stays sharp.
 */
export function jpgArgs({ png, out, quality }) {
  return [
    '-nostdin', '-v', 'error', '-y', '-i', png,
    '-vf', 'scale=out_color_matrix=bt601:out_range=pc,format=yuvj444p',
    '-frames:v', '1', '-c:v', 'mjpeg', '-q:v', String(jpegQscale(quality)), '-qmin', '1',
    '-update', '1', '-f', 'image2', out,
  ];
}

/**
 * GIF from the finished MP4. One palette for the whole clip built from the pixels that change
 * (stats_mode=diff), ordered bayer dithering (stable between frames, so unchanged areas stay
 * identical and compress) and only the changed rectangle written per frame. palettegen keeps
 * its default reserved transparent entry: the encoder marks unchanged pixels transparent with it,
 * without it a 1000 px GIF of a typical banner came out 3.6x larger. Measured alternatives
 * (bayer_scale 4/5, sierra, no dithering, denoising first) saved under 5% on a real banner.
 */
export function gifArgs({ mp4, out, width, fps, threads = 3 }) {
  return [
    '-nostdin', '-v', 'error', '-y', '-i', mp4,
    '-filter_complex',
    `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle`,
    '-threads', String(threads),
    '-loop', '0', '-f', 'gif', out,
  ];
}
