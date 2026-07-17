import SwiftUI
import RealityKit
import ARKit

struct ARViewContainer: UIViewRepresentable {
  let usdzURL: URL

  func makeUIView(context: Context) -> ARView {
    let view = ARView(frame: .zero)
    view.automaticallyConfigureSession = false
    let config = ARWorldTrackingConfiguration()
    config.planeDetection = [.horizontal]
    config.environmentTexturing = .automatic
    view.session.run(config)

    let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleTap(_:)))
    view.addGestureRecognizer(tap)
    context.coordinator.arView = view
    context.coordinator.usdzURL = usdzURL
    return view
  }

  func updateUIView(_ uiView: ARView, context: Context) {
    context.coordinator.usdzURL = usdzURL
  }

  func makeCoordinator() -> Coordinator {
    Coordinator()
  }

  final class Coordinator: NSObject {
    weak var arView: ARView?
    var usdzURL: URL?
    private var placedAnchor: AnchorEntity?

    @objc func handleTap(_ gesture: UITapGestureRecognizer) {
      guard let arView, let usdzURL else { return }
      let point = gesture.location(in: arView)
      let results = arView.raycast(from: point, allowing: .estimatedPlane, alignment: .horizontal)
      guard let hit = results.first else { return }

      placedAnchor?.removeFromParent()
      Task { @MainActor in
        do {
          let entity = try await Entity.load(contentsOf: usdzURL)
          let anchor = AnchorEntity(world: hit.worldTransform)
          anchor.addChild(entity)
          arView.scene.addAnchor(anchor)
          placedAnchor = anchor
        } catch {
          print("USDZ load failed: \(error)")
        }
      }
    }
  }
}
