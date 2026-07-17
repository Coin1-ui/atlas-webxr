import Foundation

struct CatalogManifest: Codable {
  var version: Int
  var models: [CatalogModel]
}

struct CatalogModel: Codable, Identifiable {
  var id: String
  var name: String
  var icon: String?
  var glb: String?
  var usdz: String?
  var iconUrl: String?
  var usdzUrl: String?
}

enum CatalogLoader {
  /// Set `ATLAS_MANIFEST_URL` in Info.plist or replace default for production.
  static func fetch(from url: URL) async throws -> [CatalogModel] {
    let (data, _) = try await URLSession.shared.data(from: url)
    let manifest = try JSONDecoder().decode(CatalogManifest.self, from: data)
    return manifest.models.filter { $0.usdz != nil || $0.usdzUrl != nil }
  }

  static func usdzURL(for model: CatalogModel, base: URL) -> URL? {
    if let u = model.usdzUrl, let url = URL(string: u) { return url }
    if let file = model.usdz { return base.appendingPathComponent(file) }
    return nil
  }
}
