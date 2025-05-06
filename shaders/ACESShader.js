"use strict";
/** @module ACESShader */

/**
 * ACES Tone Mapping shader for post-processing effects in Three.js.
 * Based on the ACES filmic tone-mapping curve from The Baking Lab demo.
 *
 * @constant
 * @type {ShaderMaterial~Shader}
 */
export const ACESShader = {

    name: 'ACESShader',
  
    uniforms: {
      // The input texture
      'tDiffuse': { value: null },
      // Exposure adjustment
      'toneMappingExposure': { value: 1.0 },
      // Gamma correction value
      'Gamma': { value: 2.2 }, 
      // Pass-through
      'passthrough': { value: 1 } 
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
      uniform float toneMappingExposure;
      uniform float Gamma;
      uniform int passthrough;
      varying vec2 vUv;
  
      // Constants for the ACES input and output matrix transformations
      const mat3 ACESInputMat = mat3(
        vec3( 0.59719, 0.07600, 0.02840 ),
        vec3( 0.35458, 0.90834, 0.13383 ),
        vec3( 0.04823, 0.01566, 0.83777 )
      );
    
      const mat3 ACESOutputMat = mat3(
        vec3(  1.60475, -0.10208, -0.00327 ),
        vec3( -0.53108,  1.10813, -0.07276 ),
        vec3( -0.07367, -0.00605,  1.07602 )
      );
  
      // Renamed function to avoid conflicts
      vec3 RRTAndODTFit( vec3 v ) {
        vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
        vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
        return a / b;
      }
  
      void main() {
        // Fetch the color from the texture (input image)
        vec3 inputColor = texture2D(tDiffuse, vUv).rgb;
        vec3 toneMappedColor = texture2D(tDiffuse, vUv).rgb;
  
        // Exposure adjustment
        toneMappedColor *= toneMappingExposure;
  
        // Apply ACES color space transformations
        toneMappedColor = ACESInputMat * toneMappedColor;
        toneMappedColor = RRTAndODTFit(toneMappedColor);
        toneMappedColor = ACESOutputMat * toneMappedColor;
  
        // Clamp the values to [0, 1]
        toneMappedColor = clamp(toneMappedColor, 0.0, 1.0);
  
        // Apply gamma correction once after the tonemapping
        toneMappedColor = pow(toneMappedColor, vec3(1.0 / Gamma));

        // Exposure for the input color
        inputColor *= toneMappingExposure;
  
        // Output the final color
        gl_FragColor = vec4(inputColor, 1.0) * vec4(1 - passthrough) + vec4(toneMappedColor, 1.0) * vec4(passthrough);
      }
    `
  };