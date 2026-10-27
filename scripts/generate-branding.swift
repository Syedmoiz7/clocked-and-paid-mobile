// Recreates the client's C&P wordmark as sharp native launch assets.
// Run from mobile/: swift -module-cache-path /private/tmp/clocked-paid-swift-cache scripts/generate-branding.swift
import AppKit

let size = 1024
let output = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
  .appendingPathComponent("assets/branding", isDirectory: true)
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)

func color(_ hex: UInt32) -> CGColor {
  CGColor(red: CGFloat((hex >> 16) & 255) / 255,
          green: CGFloat((hex >> 8) & 255) / 255,
          blue: CGFloat(hex & 255) / 255, alpha: 1)
}

func render(_ filename: String, opaque: Bool = false, tile: CGRect? = nil,
            radius: CGFloat = 0, fontSize: CGFloat) throws {
  let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8,
    bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: opaque ? CGImageAlphaInfo.noneSkipLast.rawValue : CGImageAlphaInfo.premultipliedLast.rawValue)!
  if let tile = tile {
    context.saveGState()
    context.addPath(CGPath(roundedRect: tile, cornerWidth: radius, cornerHeight: radius, transform: nil))
    context.clip()
    let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
      colors: [color(0xd85a88), color(0xad2959)] as CFArray, locations: [0, 1])!
    context.drawLinearGradient(gradient, start: CGPoint(x: tile.minX, y: tile.maxY),
      end: CGPoint(x: tile.maxX, y: tile.minY), options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
    context.restoreGState()
  }
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
  let label = NSAttributedString(string: "C&P", attributes: [
    .font: NSFont.systemFont(ofSize: fontSize, weight: .heavy),
    .foregroundColor: NSColor.white,
  ])
  let bounds = label.size()
  label.draw(at: CGPoint(x: (CGFloat(size) - bounds.width) / 2,
                         y: (CGFloat(size) - bounds.height) / 2))
  NSGraphicsContext.restoreGraphicsState()
  let bitmap = NSBitmapImageRep(cgImage: context.makeImage()!)
  let data = bitmap.representation(using: .png, properties: [:])!
  try data.write(to: output.appendingPathComponent(filename))
  print("Generated \(filename) (\(size)×\(size))")
}

try render("icon.png", opaque: true,
  tile: CGRect(x: 0, y: 0, width: size, height: size), fontSize: 245)
try render("adaptive-foreground.png", fontSize: 195)
try render("adaptive-monochrome.png", fontSize: 195)
try render("splash-icon.png", tile: CGRect(x: 92, y: 92, width: 840, height: 840),
  radius: 190, fontSize: 245)
