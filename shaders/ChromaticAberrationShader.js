"use strict";
const ChromaticAberrationShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'aberrationIntensity': { value: 0.01 }, // Controls the maximum intensity of the effect
        'power': { value: 2.0 },
        'samples': { value: 4 }
    },

    vertexShader: /* glsl */`
        varying vec2 vUv;

        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float aberrationIntensity;
        uniform float power;
        uniform int samples;

        varying vec2 vUv;

        void main() {
            // Calculate the distance from the center (0.5, 0.5) in normalized UV space
            vec2 center = vec2(0.5);
            float dist = pow(distance(vUv, center), power);
            vec2 direction = vUv * vec2(2) - vec2(1);

            // Apply a gradient: at the center, the effect is 0, and at the edges, the effect is 1
            float aberrationStrength = dist * aberrationIntensity;

            vec2 redOffset;
            vec2 greenOffset;
            vec2 blueOffset;

            vec4 red = vec4(0.0);
            vec4 green = vec4(0.0);
            vec4 blue = vec4(0.0);

            for (int i = 1; i <= samples; ++i) {
                float scale = float(i);

                red += texture2D(tDiffuse, vUv + direction * aberrationStrength * -0.33/float(samples) * scale);
                green += texture2D(tDiffuse, vUv + direction * aberrationStrength * -0.66/float(samples) * scale);
                blue += texture2D(tDiffuse, vUv + direction * aberrationStrength * -1.0/float(samples) * scale);
            }

            red /= float(samples);
            green /= float(samples);
            blue /= float(samples);
                    
            // Combine the color channels
            gl_FragColor = vec4(red.r, green.g, blue.b, 1.0);

        }
    `
};

export { ChromaticAberrationShader };