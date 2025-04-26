export const toonShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'width': { value: null },
        'height': { value: null },
    },

    vertexShader: /* glsl */`
        varying vec2 vUv;

        void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
        }
    `,

    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        varying vec2 vUv;

        uniform float width;
        uniform float height;

        void main() {
            vec3 color;

            color = texture2D(tDiffuse, vUv).rgb;

            // Fast percieved luminance
            float lum;
            lum = 0.2126 * color.r + 0.587 * color.g + 0.0722 * color.b;

            lum = floor(lum * 2.0) / 2.0 + 0.5;

            color = color * lum;
            
            gl_FragColor = vec4(color, 1.0);
        }
    `
};