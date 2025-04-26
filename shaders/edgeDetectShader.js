export const edgeDetectShader = {
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
        uniform sampler2D blurTexture;
        uniform sampler2D tDiffuse;
        varying vec2 vUv;

        uniform float width;
        uniform float height;

        const mat3 edgeDetect = mat3(
            0.0, -1.0, 0.0,
            -1.0, 4.0, -1.0,
            0.0, -1.0, 0.0
        );


        void main() {
            float xSize = 1.0 / (width * 1.0);
            float ySize = 1.0 / (height * 1.0);

            vec3 edges = vec3(0.0);
            
            for (int i = 0; i < 9; i++) {
                int col = i % 3;
                int row = i / 3;

                // Calculate the offset for the current kernel element
                float xOffset = xSize * float(col - 1);
                float yOffset = ySize * float(row - 1);

                edges = edges + texture2D(tDiffuse, vUv + vec2(xOffset, ySize)).rgb * vec3(edgeDetect[col][row]);
            }

            for (int i = 0; i < 9; i++) {
                int col = i % 3;
                int row = i / 3;

                // Calculate the offset for the current kernel element
                float xOffset = xSize * float(col - 1);
                float yOffset = ySize * float(row - 1);

                edges = edges + texture2D(tDiffuse, vUv + vec2(xOffset, ySize)).rgb * vec3(edgeDetect[col][row]);
            }

            edges = pow(edges, vec3(0.5));
            float lum = (edges.r + edges.g + edges.b) / 3.0;

            lum = lum > 0.3 ? 0.0 : 1.0;
            
            vec3 color = texture2D(tDiffuse, vUv).rgb * vec3(lum, lum, lum);
            gl_FragColor = vec4(color, 1.0);
        }
    `
};