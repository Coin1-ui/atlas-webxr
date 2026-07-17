import type { WebXRSessionManager } from "@babylonjs/core/XR/webXRSessionManager";
import type { Engine } from "@babylonjs/core/Engines/engine";

export type IosXrCameraAccessMode = "none" | "xr-camera-access" | "unsupported";

export type IosXrCameraPassthrough = {
  dispose: () => void;
  getMode: () => IosXrCameraAccessMode;
  getLastError: () => string | null;
  framesDrawn: () => number;
};

type XrGlBinding = {
  getCameraImage: (camera: XRCamera) => WebGLTexture | null;
};

type XrViewWithCamera = XRView & { camera?: XRCamera };

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createFullscreenProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vs = compileShader(
    gl,
    gl.VERTEX_SHADER,
    `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() {
      vUv = vec2(aPos.x * 0.5 + 0.5, 1.0 - (aPos.y * 0.5 + 0.5));
      gl_Position = vec4(aPos, 0.0, 1.0);
    }`
  );
  const fs = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    `
    precision mediump float;
    varying vec2 vUv;
    uniform sampler2D uTex;
    void main() {
      gl_FragColor = texture2D(uTex, vUv);
    }`
  );
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}

/**
 * Blit WebXR `camera-access` feed into the XR framebuffer before Babylon renders AR content.
 * getUserMedia cannot supply pixels during exclusive immersive-ar (track stays "live" but black).
 */
export function attachIosXrCameraPassthrough(
  engine: Engine,
  sessionManager: WebXRSessionManager
): IosXrCameraPassthrough {
  let mode: IosXrCameraAccessMode = "none";
  let lastError: string | null = null;
  let framesDrawn = 0;
  let binding: XrGlBinding | null = null;
  let program: WebGLProgram | null = null;
  let posBuffer: WebGLBuffer | null = null;
  let posLoc = -1;
  let texLoc: WebGLUniformLocation | null = null;

  const gl = engine._gl as WebGLRenderingContext | null;
  const session = sessionManager.session;

  if (!gl || !session) {
    lastError = "no-gl-or-session";
    return {
      dispose: () => {},
      getMode: () => mode,
      getLastError: () => lastError,
      framesDrawn: () => framesDrawn,
    };
  }

  if (typeof XRWebGLBinding === "undefined") {
    mode = "unsupported";
    lastError = "XRWebGLBinding-missing";
  } else {
    try {
      binding = new XRWebGLBinding(session, gl) as unknown as XrGlBinding;
      program = createFullscreenProgram(gl);
      if (!program) {
        mode = "unsupported";
        lastError = "fullscreen-shader-failed";
      } else {
        posBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 3, -1, -1, 3]),
          gl.STATIC_DRAW
        );
        posLoc = gl.getAttribLocation(program, "aPos");
        texLoc = gl.getUniformLocation(program, "uTex");
        mode = "xr-camera-access";
      }
    } catch (e) {
      mode = "unsupported";
      lastError = e instanceof Error ? e.message : "XRWebGLBinding-failed";
    }
  }

  const drawPassthrough = (frame: XRFrame) => {
    if (mode !== "xr-camera-access" || !binding || !program || !session) return;
    const refSpace = sessionManager.referenceSpace;
    if (!refSpace) return;

    const pose = frame.getViewerPose(refSpace);
    const view = pose?.views[0] as XrViewWithCamera | undefined;
    const xrCamera = view?.camera;
    const layer = session.renderState.baseLayer;
    if (!view || !xrCamera || !layer) return;

    let cameraTex: WebGLTexture | null = null;
    try {
      cameraTex = binding.getCameraImage(xrCamera);
    } catch (e) {
      lastError = e instanceof Error ? e.message : "getCameraImage-failed";
      return;
    }
    if (!cameraTex) return;

    const viewport = layer.getViewport(view);
    if (!viewport) return;

    const prevFb = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    const prevViewport = gl.getParameter(gl.VIEWPORT) as Int32Array;
    const depthTest = gl.isEnabled(gl.DEPTH_TEST);
    const blend = gl.isEnabled(gl.BLEND);

    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
    gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, cameraTex);
    gl.uniform1i(texLoc, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(posLoc);

    if (depthTest) gl.enable(gl.DEPTH_TEST);
    if (blend) gl.enable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, prevFb);
    gl.viewport(prevViewport[0], prevViewport[1], prevViewport[2], prevViewport[3]);

    framesDrawn += 1;
    lastError = null;
  };

  const observer = sessionManager.onXRFrameObservable.add((frame) => {
    drawPassthrough(frame);
  });

  return {
    dispose: () => {
      sessionManager.onXRFrameObservable.remove(observer);
      if (gl && posBuffer) gl.deleteBuffer(posBuffer);
      if (gl && program) gl.deleteProgram(program);
      binding = null;
      program = null;
      posBuffer = null;
    },
    getMode: () => mode,
    getLastError: () => lastError,
    framesDrawn: () => framesDrawn,
  };
}
