import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Texture,
  VideoTexture,
  type Camera,
} from "@babylonjs/core";

/** Behind placed content (0); reticle uses group 2. */
const IOS_VIDEO_BG_RENDERING_GROUP = 0;

export type IosSceneCameraBackground = {
  dispose: () => void;
  refresh: () => void;
};

/**
 * Fallback only — VideoTexture from getUserMedia (usually black during immersive-ar).
 * Never use infiniteDistance (renders last and covers the reticle).
 */
export function attachIosSceneCameraBackground(
  scene: Scene,
  camera: Camera,
  video: HTMLVideoElement
): IosSceneCameraBackground {
  const tex = new VideoTexture(
    "ios-ar-camera-tex",
    video,
    scene,
    false,
    true,
    Texture.BILINEAR_SAMPLINGMODE,
    {
      autoUpdateTexture: true,
      autoPlay: true,
      independentVideoSource: true,
    }
  );

  const mat = new StandardMaterial("ios-ar-camera-mat", scene);
  mat.emissiveTexture = tex;
  mat.emissiveColor = new Color3(1, 1, 1);
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  mat.disableDepthWrite = true;

  const dome = MeshBuilder.CreateSphere(
    "ios-ar-camera-dome",
    { diameter: 40, segments: 16, sideOrientation: Mesh.BACKSIDE },
    scene
  );
  dome.material = mat;
  dome.parent = camera;
  dome.isPickable = false;
  dome.renderingGroupId = IOS_VIDEO_BG_RENDERING_GROUP;

  const refresh = () => {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      tex.update();
    }
    if (video.paused) {
      void video.play().catch(() => {});
    }
  };

  scene.onBeforeRenderObservable.add(refresh);

  return {
    dispose: () => {
      scene.onBeforeRenderObservable.removeCallback(refresh);
      dome.dispose();
      mat.dispose();
      tex.dispose();
    },
    refresh,
  };
}
