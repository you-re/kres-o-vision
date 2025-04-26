export const gaussianBlurShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'width': { value: null },
        'height': { value: null }
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

        const mat3 gaussBlur = mat3(
            1.0, 2.0, 1.0,
            2.0, 4.0, 2.0,
            1.0, 2.0, 1.0
        );

        void main() {

            float xSize = 1.0 / (width * 1.0);
            float ySize = 1.0 / (height * 1.0);

            vec3 edges = vec3(0.0);
            vec3 blur = vec3(0.0);

            // Blur the image first
            for (int i = 0; i < 9; i++) {
                int col = i % 3;
                int row = i / 3;

                // Calculate the offset for the current kernel element
                float xOffset = xSize * float(col - 1);
                float yOffset = ySize * float(row - 1);

                blur = blur + texture2D(tDiffuse, vUv + vec2(xOffset, ySize)).rgb * vec3(gaussBlur[col][row]);
            }

            blur /= vec3(16.0);
            
            gl_FragColor = vec4(blur, 1.0);
        }
    `
};