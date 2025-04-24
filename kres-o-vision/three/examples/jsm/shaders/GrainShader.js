const GrainShader = {
    uniforms: {
        'tDiffuse': { value: null },      // The rendered scene
        'grainIntensity': { value: 0.05 }, // Grain intensity
        'grainSize': { value: 1.0 },      // Grain size (scaling the noise)
        'time': { value: 0.0 },           // Time to animate the grain (optional)
    },

    vertexShader: /* glsl */`
        varying vec2 vUv;

        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    fragmentShader: /* glsl */`
        precision mediump float;
        
        varying vec2 vUv;
        
        uniform sampler2D tDiffuse;  // The original scene texture
        uniform float grainIntensity; // Intensity of the grain effect
        uniform float grainSize;     // Scale of the grain
        uniform float time;          // Time for animating grain

        // Simple noise function
        float rand(vec2 co) {
            return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
            // Fetch the original color from the texture
            vec3 color = texture2D(tDiffuse, vUv).rgb;
            float brightness = max(0.0, (1.0 - length(color) - 0.2));

            // Generate random noise based on the pixel's coordinates
            vec2 grainPos = vUv * grainSize + time * 0.1; // Time is added for animation
            float noiseR = rand(grainPos + vec2(0.0, 0.0)); // Random value between 0.0 and 1.0
            float noiseG = rand(grainPos + vec2(0.1, 0.1)); // Random value between 0.0 and 1.0
            float noiseB = rand(grainPos + vec2(0.2, 0.2)); // Random value between 0.0 and 1.0
            
            // Apply the noise with the intensity factor
            vec3 grain = vec3(noiseR, noiseG, noiseB) * grainIntensity;
            
            // Add the grain to the color
            gl_FragColor = vec4(color + grain * brightness, 1.0);
        }
    `
};

export { GrainShader };
