const ChromaticAberrationShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'aberrationIntensity': { value: 0.1 }, // Controls the maximum intensity of the effect
        'power': { value: 2.0 }
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

        varying vec2 vUv;

        void main() {
            // Calculate the distance from the center (0.5, 0.5) in normalized UV space
            vec2 center = vec2(0.5);
            float dist = pow(distance(vUv, center), power);

            // Apply a gradient: at the center, the effect is 0, and at the edges, the effect is 1
            float aberrationStrength = dist * aberrationIntensity;

            // Offsets for the RGB channels
            vec2 redOffset = vec2(aberrationStrength*0.0, aberrationStrength*0.0);   // Red channel will move horizontally
            vec2 greenOffset = vec2(aberrationStrength*0.5, aberrationStrength*0.5); // Green channel will move vertically
            vec2 blueOffset = vec2(aberrationStrength*1.0, aberrationStrength*1.0); // Blue moves both ways

            // Sample the texture for each color channel with different offsets
            vec4 texel = texture2D(tDiffuse, vUv);
            vec4 red = texture2D(tDiffuse, vUv + redOffset);
            vec4 green = texture2D(tDiffuse, vUv + greenOffset);
            vec4 blue = texture2D(tDiffuse, vUv + blueOffset);

            // Combine the color channels
            gl_FragColor = vec4(red.r, green.g, blue.b, texel.a);
            // gl_FragColor = vec4(dist);
        }
    `
};

export { ChromaticAberrationShader };
