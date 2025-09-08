// Index.tsx
import { MathJax, MathJaxContext } from "better-react-mathjax";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import MathJaxSVG from "react-native-mathjax-svg";

const API_URL = "https://nomieai.vercel.app/api/llm";

/** ---------- Upload size controls ---------- */
// Keep base64 safely under Groq (4MB) and Vercel body (4.5MB) limits
const MAX_BASE64_BYTES = Math.floor(3.7 * 1024 * 1024); // ~3.7MB headroom
const START_LONG_EDGE = 1280;  // good balance for quality/size
const MIN_QUALITY = 0.4;       // don’t go below this
const ATTEMPTS = 5;

/** Resize + recompress until base64 fits within MAX_BASE64_BYTES */
async function shrinkToLimit(
  uri: string,
  originalW?: number,
  originalH?: number,
  startEdge = START_LONG_EDGE
): Promise<{ dataUri: string; width: number; height: number; b64Bytes: number }> {
  let longEdge = Math.min(Math.max(originalW ?? startEdge, originalH ?? startEdge), startEdge);
  let quality = 0.7;

  for (let i = 0; i < ATTEMPTS; i++) {
    // Choose which dimension to constrain based on orientation.
    const resize:
      | { width: number; height?: undefined }
      | { height: number; width?: undefined } =
      (originalW ?? 0) >= (originalH ?? 0)
        ? { width: longEdge }
        : { height: longEdge };

    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize }],
      {
        compress: quality, // 0..1
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    const b64 = result.base64 ?? "";
    const b64Bytes = b64.length; // Base64 chars are single-byte in JSON

    if (b64Bytes <= MAX_BASE64_BYTES) {
      return {
        dataUri: `data:image/jpeg;base64,${b64}`,
        width: result.width,
        height: result.height,
        b64Bytes,
      };
    }

    // Tighten for next pass
    longEdge = Math.floor(longEdge * 0.8);
    quality = Math.max(MIN_QUALITY, quality - 0.1);
  }

  // Final attempt (may still be large, but we tried our best)
  throw new Error("Could not shrink image under size limit after several attempts.");
}

/** ---------- Web/native math renderer ---------- */
const RNMath = ({
  latex,
  display = false,
}: {
  latex: string;
  display?: boolean;
}) =>
  Platform.OS === "web" ? (
    <MathJaxContext>
      <MathJax dynamic>{display ? `\\[${latex}\\]` : `\\(${latex}\\)`}</MathJax>
    </MathJaxContext>
  ) : (
    <MathJaxSVG fontSize={display ? 18 : 14} color="black" fontCache>
      {display ? `$$${latex}$$` : `$${latex}$`}
    </MathJaxSVG>
  );

/** ---------- Helpers to split text vs math ---------- */
type Chunk =
  | { type: "text"; value: string }
  | { type: "math"; value: string; display: boolean };

// Matches: \[...\] | $$...$$ | \(...\) | $...$ | \begin{aligned}...\end{aligned} | \boxed{...}
const MATH_REGEX =
  /(\\\[([\s\S]*?)\\\])|(\$\$([\s\S]*?)\$\$)|(\\\(([\s\S]*?)\\\))|(\$([^$]*?)\$)|(\\begin\{aligned\}[\s\S]*?\\end\{aligned\})|(\\boxed\{[\s\S]*?\})/g;

function splitAnswer(input: string): Chunk[] {
  const out: Chunk[] = [];
  let last = 0;

  input.replace(
    MATH_REGEX,
    (
      match: string,
      _g1: string,
      brack: string,
      _g3: string,
      dbl: string,
      _g5: string,
      paren: string,
      _g7: string,
      inline: string,
      aligned: string,
      boxed: string,
      offset: number
    ) => {
      const i = offset;
      if (i > last) out.push({ type: "text", value: input.slice(last, i) });

      if (dbl != null) out.push({ type: "math", value: dbl, display: true });
      else if (brack != null) out.push({ type: "math", value: brack, display: true });
      else if (paren != null) out.push({ type: "math", value: paren, display: false });
      else if (inline != null) out.push({ type: "math", value: inline, display: false });
      else if (aligned != null) out.push({ type: "math", value: aligned, display: true });
      else if (boxed != null) out.push({ type: "math", value: boxed, display: false });

      last = i + match.length;
      return match;
    }
  );

  if (last < input.length) out.push({ type: "text", value: input.slice(last) });
  return out;
}

/** ---------- FormattedAnswer component (compact spacing) ---------- */
const FormattedAnswer = ({ answer }: { answer: string }) => {
  const chunks = splitAnswer(answer);

  const renderTextBlock = (text: string, keyBase: string) => {
    // Normalize line endings and collapse repeated blanks
    const lines = text.replace(/\r/g, "").split("\n");
    const els: React.ReactNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.trim();

      // Skip empty or lone hyphen lines (these often come from bullet formatting)
      if (!line || line === "-") continue;

      if (line.startsWith("## ")) {
        els.push(
          <Text key={`${keyBase}-h2-${i}`} style={styles.h2}>
            {line.substring(3)}
          </Text>
        );
        continue;
      }
      if (line.startsWith("### ")) {
        els.push(
          <Text key={`${keyBase}-h3-${i}`} style={styles.h3}>
            {line.substring(4)}
          </Text>
        );
        continue;
      }
      if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
        els.push(
          <Text key={`${keyBase}-b-${i}`} style={styles.bold}>
            {line.slice(2, -2)}
          </Text>
        );
        continue;
      }

      // Bullets: "- " or "•"
      if (line.startsWith("- ")) {
        els.push(
          <Text key={`${keyBase}-li-${i}`} style={styles.li}>
            {"\u2022 "} {line.slice(2)}
          </Text>
        );
        continue;
      }
      if (line.startsWith("•")) {
        els.push(
          <Text key={`${keyBase}-li2-${i}`} style={styles.li}>
            {"\u2022 "} {line.slice(1).trimStart()}
          </Text>
        );
        continue;
      }

      // Default paragraph line
      els.push(
        <Text key={`${keyBase}-p-${i}`} style={styles.p}>
          {raw.trimEnd()}
        </Text>
      );
    }

    return els;
  };

  return (
    <View>
      {chunks.map((c, idx) =>
        c.type === "text" ? (
          <View key={`t-${idx}`}>{renderTextBlock(c.value, `t-${idx}`)}</View>
        ) : (
          <View key={`m-${idx}`} style={c.display ? styles.mathBlock : styles.mathInline}>
            <RNMath latex={c.value} display={c.display} />
          </View>
        )
      )}
    </View>
  );
};

/** ---------- Screen ---------- */
export default function Index() {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickAndShrink = async (useCamera: boolean) => {
    try {
      if (useCamera) {
        await ImagePicker.requestCameraPermissionsAsync();
      } else {
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      }

      const launcher = useCamera
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync;

      const result = await launcher({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, // user can crop; not a strict pixel limiter
        aspect: [4, 3],
        quality: 1,          // pick full quality; we’ll control compression ourselves
        base64: false,       // we’ll generate base64 *after* resizing
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      const { uri, width, height } = asset;

      const shrunk = await shrinkToLimit(uri, width, height, START_LONG_EDGE);
      setImage(shrunk.dataUri);
    } catch (e: any) {
      setError(e?.message ?? "Image selection failed");
    }
  };

  const ask = async () => {
    if (!prompt.trim() && !image) return;
    setLoading(true);
    setError(null);
    setAnswer("");
    try {
      const resp = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, image }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setAnswer(data.text);
    } catch (e: any) {
      setError(e.message ?? "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Ask the model</Text>

        <View style={styles.topButtonContainer}>
          <TouchableOpacity style={styles.topButton} onPress={() => pickAndShrink(true)}>
            <Text style={styles.topButtonText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.topButton} onPress={() => pickAndShrink(false)}>
            <Text style={styles.topButtonText}>Choose from Library</Text>
          </TouchableOpacity>
        </View>

        {image && (
          <View>
            <Image source={{ uri: image }} style={styles.imagePreview} />
            <TouchableOpacity style={styles.removeButton} onPress={() => setImage(null)}>
              <Text style={styles.removeButtonText}>Remove Image</Text>
            </TouchableOpacity>
          </View>
        )}

        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          placeholder="(Optional) add ingredients not in image…"
          placeholderTextColor="#888"
          multiline
          style={styles.input}
        />

        <TouchableOpacity style={styles.sendButton} onPress={ask}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
        {loading && <ActivityIndicator />}
        {!!error && <Text style={styles.errorText}>{error}</Text>}
        {!!answer && (
          <View style={styles.answerContainer}>
            <Text style={styles.answerTitle}>Answer</Text>
            <FormattedAnswer answer={answer} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/** ---------- Styles ---------- */
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { padding: 20, gap: 12 },
  title: { fontSize: 25, fontWeight: "600", textAlign: "center", marginTop: 10, marginBottom: 10 },

  // Text styles with compact spacing
  p: { marginBottom: 10, lineHeight: 20, fontSize: 20 },
  li: { marginBottom: 10, lineHeight: 20, fontSize: 20 },
  bold: { fontWeight: "bold", marginBottom: 6, fontSize: 20 },
  h2: { fontSize: 24, fontWeight: "bold", marginTop: 10, marginBottom: 6 },
  h3: { fontSize: 22, fontWeight: "bold", marginTop: 8, marginBottom: 4 },

  // Math spacing (tighter)
  mathBlock: { marginVertical: 6 },
  mathInline: { marginVertical: 0 },

  input: {
    fontSize: 17,
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    minHeight: 80,
  },
  errorText: { color: "red" },
  answerContainer: { marginTop: 12 },
  answerTitle: { fontWeight: "600", fontSize: 20, marginBottom: 8 },

  stepHeader: { fontWeight: "bold", marginTop: 8, fontSize: 16, marginBottom: 4 },
  stepContent: { fontSize: 14, lineHeight: 20 },
  finalAnswerContainer: { marginTop: 16, alignItems: "center" },
  finalAnswerText: { fontWeight: "bold", fontSize: 16 },
  boxedAnswer: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: "#007AFF",
    borderRadius: 8,
    backgroundColor: "#f0f8ff",
  },
  boxedAnswerText: { fontSize: 28, fontWeight: "bold", color: "#007AFF" },
  mathExpression: {
    fontStyle: "italic",
    fontFamily: "monospace",
    backgroundColor: "#eee",
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  mathView: { width: "100%" },
  imagePreview: { width: "100%", height: 200, borderRadius: 8, marginBottom: 12 },

  topButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 10,
  },
  topButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: "center",
    flex: 1,
    marginHorizontal: 5,
  },
  topButtonText: { color: "white", fontSize: 20, fontWeight: "bold" },
  sendButton: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  sendButtonText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  removeButton: {
    backgroundColor: "#FF3B30",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  removeButtonText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
});

