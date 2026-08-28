import Foundation
import Vision

struct SelfTestResult: Encodable {
  let ok: Bool
  let runtime: String
  let capabilities: [String: Bool]
}

func printJSON<T: Encodable>(_ value: T) {
  let encoder = JSONEncoder()
  guard let data = try? encoder.encode(value), let text = String(data: data, encoding: .utf8) else {
    exit(1)
  }
  print(text)
}

guard CommandLine.arguments.dropFirst().first == "--self-test" else {
  fputs("usage: vision-edge-worker --self-test\n", stderr)
  exit(64)
}

// Constructing these requests verifies the locally installed Vision APIs without
// processing a camera frame or retaining image data.
let face = VNDetectFaceRectanglesRequest()
let human = VNDetectHumanRectanglesRequest()
let classification = VNClassifyImageRequest()
_ = face.revision
_ = human.revision
_ = classification.revision

printJSON(SelfTestResult(
  ok: true,
  runtime: "apple_vision",
  capabilities: [
    "face_detection": true,
    "human_detection": true,
    "image_classification": true,
    "face_recognition": false,
    "biometric_matching": false
  ]
))
