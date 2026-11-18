import { memo, useEffect, useRef } from 'react';

// A decorative, static layer with no dependency on account or portfolio state.
export default memo(function PaperBackground() {
  const surfaceRef = useRef(null);

  useEffect(() => {
    const surface = surfaceRef.current;
    let cancelled = false;
    let shader;

    async function mountPaper() {
      try {
        const { ShaderMount, paperTextureFragmentShader, getShaderNoiseTexture, getShaderColorFromString } = await import('@paper-design/shaders');
        if (cancelled) return;
        const noise = getShaderNoiseTexture();
        await noise.decode();
        if (cancelled) return;

        shader = new ShaderMount(surface, paperTextureFragmentShader, {
          u_image: noise,
          u_isImage: false,
          u_noiseTexture: noise,
          u_colorBack: getShaderColorFromString('#f2f1ed'),
          u_colorPaper: getShaderColorFromString('#f2f1ed'),
          u_colorShadow: getShaderColorFromString('#ceccc4'),
          u_blending: 1,
          u_distortion: 0,
          u_clip: false,
          u_angle: 300,
          u_seed: 12,
          u_roughness: 0.34,
          u_roughnessSize: 0.08,
          u_roughnessRows: 0,
          u_fiber: 0.22,
          u_fiberSize: 0.12,
          u_folds: 0,
          u_foldSizeX: 1,
          u_foldSizeY: 1,
          u_foldOffsetX: 0,
          u_foldOffsetY: 0,
          u_wrinkles: 0,
          u_wrinkleSize: 0.6,
          u_crumples: 0,
          u_crumpleCount: 6,
          u_drops: 0,
          u_fit: 2,
          u_scale: 0.9,
          u_rotation: 0,
          u_offsetX: 0,
          u_offsetY: 0,
          u_originX: 0.5,
          u_originY: 0.5,
        }, undefined, 0, 0, 1, 2073600);
        // Speed 0 renders only on initialization/resize, with a bounded pixel count.
      } catch {
        if (cancelled) return;
        // Keep the CSS texture when WebGL or the optional shader chunk is unavailable.
        const canvas = surface.querySelector('canvas');
        canvas?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
        canvas?.remove();
      }
    }

    mountPaper();
    return () => {
      cancelled = true;
      shader?.dispose();
    };
  }, []);

  return <div ref={surfaceRef} className="paper-background" aria-hidden="true" />;
});
