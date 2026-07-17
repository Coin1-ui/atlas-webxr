import SwiftUI

struct ContentView: View {
  @State private var models: [CatalogModel] = []
  @State private var selected: CatalogModel?
  @State private var assetBase = URL(string: "https://example.com/custom-models/")!
  @State private var loadError: String?

  var body: some View {
    NavigationView {
      Group {
        if let model = selected, let url = CatalogLoader.usdzURL(for: model, base: assetBase) {
          ARViewContainer(usdzURL: url)
            .ignoresSafeArea()
            .overlay(alignment: .topLeading) {
              Button("Back") { selected = nil }
                .padding()
                .background(.ultraThinMaterial)
                .cornerRadius(8)
                .padding()
            }
        } else {
          List(models) { model in
            Button(model.name) {
              selected = model
            }
          }
          .navigationTitle("Atlas Field AR")
          .overlay {
            if models.isEmpty {
              VStack(spacing: 8) {
                Text("No USDZ models").font(.headline)
                Text(loadError ?? "Upload .usdz files from the PC model manager.")
                  .font(.subheadline)
                  .multilineTextAlignment(.center)
                  .foregroundStyle(.secondary)
              }
              .padding()
            }
          }
        }
      }
      .task { await loadCatalog() }
    }
  }

  private func loadCatalog() async {
    guard let manifestURL = Bundle.main.url(forResource: "manifest", withExtension: "json") else {
      loadError = "Add manifest.json to the app bundle or set ATLAS_MANIFEST_URL."
      return
    }
    do {
      models = try await CatalogLoader.fetch(from: manifestURL)
      assetBase = manifestURL.deletingLastPathComponent()
    } catch {
      loadError = error.localizedDescription
    }
  }
}

@main
struct AtlasFieldARApp: App {
  var body: some Scene {
    WindowGroup {
      ContentView()
    }
  }
}
